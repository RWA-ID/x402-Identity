// x402id-swap — keeps the 0x API key server-side and pins every quote to
// ETH <-> X402ID on Base with the integrator fee going to the x402 Safe.
// The site calls /price (indicative) and /quote (firm, returns the tx to sign).

const CHAIN_ID = "8453";
const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const X402ID = "0xb9490fc272642A7De0539FB3dC52A2769936FBa3";
const FEE_RECIPIENT = "0x8E61630A73a38B5A1b7AE8dAA8AeAD364403631C"; // x402 Safe (Base, 2-of-3)
const FEE_BPS = "10"; // 0.10%, taken in ETH on both sides

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS },
  });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (req.method !== "GET") return json({ error: "method not allowed" }, 405);

    const url = new URL(req.url);
    const endpoint = url.pathname.replace(/^\/+|\/+$/g, "");
    if (endpoint === "" || endpoint === "health") return json({ ok: true, token: X402ID, chainId: 8453 });
    if (endpoint !== "price" && endpoint !== "quote") return json({ error: "not found" }, 404);

    const side = url.searchParams.get("side");
    const amount = url.searchParams.get("amount") ?? "";
    const taker = url.searchParams.get("taker") ?? "";
    const slippage = Number(url.searchParams.get("slippageBps") ?? "100");

    if (side !== "buy" && side !== "sell") return json({ error: "side must be buy or sell" }, 400);
    if (!/^[1-9][0-9]{0,77}$/.test(amount)) return json({ error: "amount must be a positive integer in wei" }, 400);
    if (!/^0x[0-9a-fA-F]{40}$/.test(taker)) return json({ error: "taker must be an address" }, 400);
    if (!Number.isInteger(slippage) || slippage < 10 || slippage > 1000) {
      return json({ error: "slippageBps must be 10-1000" }, 400);
    }

    const q = new URLSearchParams({
      chainId: CHAIN_ID,
      sellToken: side === "buy" ? ETH : X402ID,
      buyToken: side === "buy" ? X402ID : ETH,
      sellAmount: amount,
      taker,
      slippageBps: String(slippage),
      swapFeeRecipient: FEE_RECIPIENT,
      swapFeeBps: FEE_BPS,
      swapFeeToken: ETH,
    });

    const upstream = await fetch(`https://api.0x.org/swap/allowance-holder/${endpoint}?${q}`, {
      headers: { "0x-api-key": env.ZEROX_API_KEY, "0x-version": "v2" },
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "content-type": "application/json", "cache-control": "no-store", ...CORS },
    });
  },
};
