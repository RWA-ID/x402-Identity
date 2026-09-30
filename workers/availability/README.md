# x402id-availability

Paid name-availability check for x402 Identity Hub, listed in the x402 Bazaar (and so on agentic.market).

`GET /v1/availability/:name` — e.g. `/v1/availability/mybot.402bot.eth` — costs **$0.001 USDC on Base**, paid to the x402id Safe `0x8E61…631C`. It returns `available`, the current `mintFee`, `registerUrl` (the site's home page) and a one-line `message` for the agent to relay. `GET /` is free and describes the service.

- Every request gets the 402 first: validators (agentic.market's `/validate`) probe the literal `/v1/availability/:name` and fail on anything else.
- The middleware only *verifies* before the handler and settles only on a < 400 response, so a malformed name (400) or a failed mainnet read (502) is never charged. Proven live: a paid call for `ab.402bot.eth` got its 400 and the payer's balance didn't move.
- Read-only: no wallet, no ETH float.

## Deploy

```sh
npm install
npx wrangler secret put CDP_API_KEY_ID       # CDP Secret API key (portal.cdp.coinbase.com → API keys)
npx wrangler secret put CDP_API_KEY_SECRET
npx wrangler secret put MAINNET_RPC_URL      # optional; public RPCs are the fallback
npx wrangler deploy
```

The CDP facilitator is what catalogs the route: **a listing appears only after the first settled payment**, which must echo the `bazaar` extension (any x402 v2 client does). Check it with `GET https://api.cdp.coinbase.com/platform/v2/x402/discovery/resources`, or agentic.market's `/validate`.

## Local test

`.dev.vars` with `TEST_FACILITATOR_URL=https://x402.org/facilitator` switches to the keyless facilitator on **Base Sepolia**, then `npx wrangler dev`. Leave it unset in production.

The startup log prints an Ajv "Error compiling schema" and "invalid bazaar extension" warning. Workers forbid `new Function`, which Ajv needs, so `@x402/extensions`' self-check of the route schema can't run. It's a lint only; the 402 still carries the full `bazaar` extension.
