// GET /v1/challenge?url=… — free. Fetches an x402 endpoint unpaid and returns
// the payment terms from its 402, for the site's /verify/ page.
//
// Exists because a browser can rarely read another seller's 402: in a sample
// of 32 Bazaar sellers answering 402, only 8 exposed PAYMENT-REQUIRED to a
// cross-origin page. It returns only the parsed terms (accepts, the
// payee-name declaration and the extension keys), never the response body, so
// it can't be used as a general proxy.

const MAX_BODY_BYTES = 64 * 1024;
const MAX_ACCEPTS = 20;
const TIMEOUT_MS = 10_000;

type Accept = { scheme?: unknown; network?: unknown; payTo?: unknown; amount?: unknown; asset?: unknown };
type Challenge = { x402Version?: unknown; accepts?: unknown; extensions?: unknown };

/** A public https URL on the default port, or an error message. */
export function checkTarget(raw: string | undefined): URL | string {
  if (!raw) return "Pass the endpoint as ?url=https://…";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "Not a URL";
  }
  if (url.protocol !== "https:") return "Only https URLs";
  if (url.username || url.password) return "URLs with credentials are not allowed";
  if (url.port && url.port !== "443") return "Only the default https port";
  const host = url.hostname;
  // Workers can't reach private networks, but an IP literal or a bare
  // hostname never names a public x402 seller, so refuse them outright.
  if (!host.includes(".") || /^[\d.]+$/.test(host) || host.startsWith("[") || host.endsWith(".local") || host === "localhost") {
    return "Use the endpoint's public hostname";
  }
  return url;
}

function decodeHeader(value: string): Challenge | null {
  try {
    return JSON.parse(atob(value)) as Challenge;
  } catch {
    return null;
  }
}

async function readCappedJson(res: Response): Promise<Challenge | null> {
  if (!res.body || !(res.headers.get("content-type") ?? "").includes("json")) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
      bytes.set(c, at);
      at += c.byteLength;
    }
    return JSON.parse(new TextDecoder().decode(bytes)) as Challenge;
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

export async function readChallenge(url: URL, method: string) {
  let res: Response;
  try {
    // Redirects are not followed: the origin that answers is the one a payee
    // name must list, so the caller should check the final URL itself.
    res = await fetch(url.href, {
      method,
      redirect: "manual",
      headers: { "user-agent": "x402id-verify/1 (+https://x402id.eth.limo/verify/)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return { ok: false as const, status: 502, error: `Could not reach ${url.origin}: ${(e as Error).message}` };
  }

  const base = { url: url.href, origin: url.origin, status: res.status };
  if (res.status >= 300 && res.status < 400) {
    await res.body?.cancel();
    return { ok: true as const, body: { ...base, redirect: res.headers.get("location") } };
  }
  if (res.status !== 402) {
    await res.body?.cancel();
    return { ok: true as const, body: { ...base, paymentRequired: false } };
  }

  const header = res.headers.get("payment-required");
  const challenge = header ? decodeHeader(header) : await readCappedJson(res);
  if (header) await res.body?.cancel();
  if (!challenge || !Array.isArray(challenge.accepts)) {
    return { ok: true as const, body: { ...base, paymentRequired: true, readable: false } };
  }

  const accepts = (challenge.accepts as Accept[]).slice(0, MAX_ACCEPTS).map((a) => ({
    scheme: str(a.scheme),
    network: str(a.network),
    payTo: str(a.payTo),
    amount: str(a.amount),
    asset: str(a.asset),
  }));
  const ext = (challenge.extensions && typeof challenge.extensions === "object" ? challenge.extensions : {}) as Record<string, unknown>;
  const declared = (ext["payee-name"] as { info?: { name?: unknown } } | undefined)?.info?.name;
  return {
    ok: true as const,
    body: {
      ...base,
      paymentRequired: true,
      readable: true,
      x402Version: typeof challenge.x402Version === "number" ? challenge.x402Version : undefined,
      accepts,
      // Only the payee-name declaration is passed on, in the shape the verifier reads.
      extensions: typeof declared === "string" ? { "payee-name": { info: { name: declared } } } : {},
      extensionKeys: Object.keys(ext).slice(0, 50),
    },
  };
}
