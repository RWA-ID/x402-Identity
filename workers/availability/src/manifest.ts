// GET /v1/manifest?url=… — free. Reads a host's /.well-known/x402 manifest
// (x402#2979) for the site's /verify/ page: the paid routes it lists and any
// payee-name it declares. Same posture as /v1/challenge: it returns only the
// parsed fields, never the body, so it can't be used as a general proxy.

const MAX_BODY_BYTES = 64 * 1024;
const MAX_RESOURCES = 50;
const TIMEOUT_MS = 10_000;

/** #2979: a resource URL must be https and on the manifest's host or a subdomain of it. */
function onHost(raw: string, host: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    const h = u.hostname.toLowerCase();
    return h === host || h.endsWith(`.${host}`) ? u : null;
  } catch {
    return null;
  }
}

async function readCapped(res: Response): Promise<unknown> {
  if (!res.body) return null;
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
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

/** `fetcher` as in readChallenge: index.ts passes the app for this worker's own hostnames. */
export async function readManifest(target: URL, fetcher: (req: Request) => Promise<Response> = fetch) {
  const url = new URL("/.well-known/x402", target.origin);
  const host = url.hostname.toLowerCase();
  let res: Response;
  try {
    res = await fetcher(new Request(url.href, {
      redirect: "manual",
      headers: { accept: "application/json", "user-agent": "x402id-verify/1 (+https://x402id.dev/verify/)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }));
  } catch (e) {
    return { ok: false as const, status: 502, error: `Could not reach ${url.origin}: ${(e as Error).message}` };
  }

  const base = { url: url.href, origin: url.origin, status: res.status };
  if (res.status >= 300 && res.status < 400) {
    await res.body?.cancel();
    return { ok: true as const, body: { ...base, found: false, redirect: res.headers.get("location") } };
  }
  const doc = res.ok ? await readCapped(res) : (await res.body?.cancel(), null);
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return { ok: true as const, body: { ...base, found: false } };
  }

  const m = doc as Record<string, unknown>;
  // An entry is a string or an object with `url` (#2979 "bare pointer or complete").
  // Off-host entries are dropped and counted, never passed on.
  const raw = Array.isArray(m.resources) ? m.resources.slice(0, MAX_RESOURCES) : [];
  const resources: { url: string; method: string }[] = [];
  let offHost = 0;
  for (const r of raw) {
    const href = typeof r === "string" ? r : typeof (r as { url?: unknown })?.url === "string" ? (r as { url: string }).url : null;
    const u = href ? onHost(href, host) : null;
    if (!u) {
      offHost++;
      continue;
    }
    const method = typeof (r as { method?: unknown })?.method === "string" ? (r as { method: string }).method.toUpperCase() : "GET";
    resources.push({ url: u.href, method });
  }
  const ext = m.extensions && typeof m.extensions === "object" ? (m.extensions as Record<string, unknown>) : {};
  const declared = (ext["payee-name"] as { info?: { name?: unknown } } | undefined)?.info?.name;

  return {
    ok: true as const,
    body: {
      ...base,
      found: true,
      x402Version: typeof m.x402Version === "number" ? m.x402Version : undefined,
      kind: typeof m.kind === "string" ? m.kind : undefined,
      resources,
      offHostResources: offHost,
      payeeName: typeof declared === "string" ? declared : null,
    },
  };
}
