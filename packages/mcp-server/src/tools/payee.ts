import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { verifyPayee, viemReader, declaredName, type PaymentRequiredLike } from "@x402identity/payee";
import type { Ctx } from "../chain.js";
import { jsonResult, errorResult } from "../result.js";

const FETCH_TIMEOUT_MS = 15_000;

/** The decoded PaymentRequired: the v2 PAYMENT-REQUIRED header, else a v2 JSON body. */
async function readChallenge(res: Response): Promise<PaymentRequiredLike | null> {
  const header = res.headers.get("payment-required");
  if (header) return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  try {
    const body = (await res.json()) as Partial<PaymentRequiredLike> | null;
    return body && Array.isArray(body.accepts) ? (body as PaymentRequiredLike) : null;
  } catch {
    return null;
  }
}

export function registerPayeeTool(server: McpServer, ctx: Ctx) {
  server.registerTool(
    "verify_payee",
    {
      description:
        "Before paying an x402 endpoint, check who you would be paying. Fetches the URL without " +
        "paying, reads its 402 challenge and verifies the `payee-name` extension: the ENS name it " +
        "declares must list the origin that answered (text record org.x402.origins) and each payTo " +
        "address on its network, and must not be expired. Returns one verdict per payment option: " +
        "true (payee-bound), false (with a reason such as origin-not-listed or payto-not-listed), or " +
        "\"inconclusive\" (e.g. a failed chain read, which is never a refusal).",
      inputSchema: {
        url: z.string().describe("The x402 resource URL, e.g. https://api.example.com/v1/forecast"),
        method: z
          .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"])
          .optional()
          .describe("HTTP method the endpoint is paid on (default GET)"),
      },
    },
    async ({ url, method }) => {
      let target: URL;
      try {
        target = new URL(url);
      } catch {
        return errorResult(`Not a URL: ${url}`);
      }
      if (target.protocol !== "https:" && target.protocol !== "http:") {
        return errorResult("Only http(s) URLs can be checked");
      }

      let res: Response;
      try {
        res = await fetch(target, { method: method ?? "GET", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      } catch (err) {
        return errorResult(`Could not reach ${target.origin}: ${(err as Error).message}`);
      }
      // The challenge came from wherever the redirects ended, so that origin is
      // the one the name must list.
      const origin = new URL(res.url || target.href).origin;

      if (res.status !== 402) {
        return jsonResult({ url, origin, status: res.status, paymentRequired: false });
      }
      let pr: PaymentRequiredLike | null;
      try {
        pr = await readChallenge(res);
      } catch (err) {
        return errorResult(`The 402 challenge could not be decoded: ${(err as Error).message}`);
      }
      if (!pr) return errorResult("Got a 402 without a readable payment challenge");

      const accepts = pr.accepts.map((a) => ({ network: a.network, payTo: a.payTo }));
      const name = declaredName(pr);
      if (name === undefined) {
        return jsonResult({
          url,
          origin,
          payeeName: null,
          accepts,
          message: "This endpoint does not declare payee-name, so nothing binds its payTo to a named operator.",
        });
      }

      try {
        const verdicts = await verifyPayee(pr, origin, viemReader(ctx.publicClient));
        return jsonResult({ url, origin, payeeName: name, accepts, verdicts });
      } catch (err) {
        return errorResult(`Verification failed: ${(err as Error).message}`);
      }
    },
  );
}
