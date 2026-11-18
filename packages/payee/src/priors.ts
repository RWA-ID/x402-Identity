// A `beforePay` hook for @priors/x402's createPayer: refuse to pay a 402 whose payee-name
// claim does not hold. This file does not import @priors/x402; it only matches the shape of
// the context their payer passes (README "Check a payment before paying (`beforePay`)").
//
//   import { payeeCheck } from "@x402identity/payee/priors";
//   const payer = createPayer({ signer, ..., beforePay: payeeCheck({ reader }) });
//
// A refusal is a thrown PayeeRefused. The payer turns it into PayError BEFORE_PAY_REFUSED
// (nothing read, borrowed or signed), with this error as `cause`.

import type { EnsReader } from "./reader.js";
import { declaredName, toOrigin, verifyPayee, type PayeeVerdict } from "./verify.js";

/** The fields of @priors/x402's beforePay context this hook reads. */
export interface BeforePayContext {
  /** The requirement the payer chose and will sign (a frozen copy). */
  readonly requirement: { readonly network: string; readonly payTo: string };
  /** The 402's top-level `extensions` (x402 v2), or null when it sent none. */
  readonly extensions: Readonly<Record<string, unknown>> | null;
  readonly x402Version: number;
  /** The URL the payer requested. */
  readonly resource: string;
  readonly signal?: AbortSignal;
}

export interface PayeeCheckOptions {
  /** Ethereum mainnet reader, e.g. `viemReader(createPublicClient({ chain: mainnet, transport: http(RPC) }))`. */
  reader: EnsReader;
  /**
   * When a 402 declares no payee name:
   * - "if-declared" (default): pay. Only a name that IS declared has to hold.
   * - "require": refuse. Pay only payees that bind their payTo to a name.
   */
  missing?: "if-declared" | "require";
  /**
   * When the chain could not answer (resolution failed, name in grace, no records):
   * - "refuse" (default): hold the payment, as the payee-name spec asks of a client that requires it.
   * - "allow": pay anyway.
   */
  inconclusive?: "refuse" | "allow";
  /** Called with every verdict reached, paid or not (for logs and receipts). */
  onVerdict?: (verdict: PayeeVerdict, ctx: BeforePayContext) => void;
}

/** Thrown to refuse a payment. `verdict` is null when no name was declared and one was required. */
export class PayeeRefused extends Error {
  readonly verdict: PayeeVerdict | null;
  constructor(message: string, verdict: PayeeVerdict | null) {
    super(message);
    this.name = "PayeeRefused";
    this.verdict = verdict;
  }
}

function abortable<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error("aborted"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new Error("aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    p.then(
      (v) => (signal.removeEventListener("abort", onAbort), resolve(v)),
      (e) => (signal.removeEventListener("abort", onAbort), reject(e)),
    );
  });
}

/**
 * Build a `beforePay` hook that checks the payee-name claim against the origin the payer
 * requested and the payTo it is about to sign for.
 *
 * The origin comes from `resource`, the URL the payer requested. @priors/x402 does not follow
 * redirects unless the caller sets `init.redirect`, so that is also the origin that answered with
 * the 402. If you set `init.redirect: "follow"`, the 402 may come from another origin and the
 * origin half of this check is made against the URL you asked for, not the one that answered
 * (the payTo half still holds: the payTo must be listed on the name).
 */
export function payeeCheck(opts: PayeeCheckOptions) {
  const { reader, missing = "if-declared", inconclusive = "refuse", onVerdict } = opts;
  if (!reader || typeof reader.text !== "function") throw new TypeError("payeeCheck: `reader` (an EnsReader) is required");
  if (missing !== "if-declared" && missing !== "require") throw new TypeError(`payeeCheck: bad \`missing\`: ${missing}`);
  if (inconclusive !== "refuse" && inconclusive !== "allow") throw new TypeError(`payeeCheck: bad \`inconclusive\`: ${inconclusive}`);

  return async function beforePay(ctx: BeforePayContext): Promise<void> {
    // A payer that predates `extensions` in the context would make every 402 look nameless,
    // so a check the caller asked for would silently never run. Fail closed instead.
    if (!("extensions" in ctx)) {
      throw new PayeeRefused("payee-name: this @priors/x402 does not pass `extensions` to beforePay, so payees cannot be checked; upgrade it", null);
    }
    // Only the requirement being signed is checked: the hook is not shown the other accepts,
    // and a verdict on one the payer will not use says nothing about this payment.
    const pr = { accepts: [ctx.requirement], extensions: (ctx.extensions ?? undefined) as Record<string, unknown> | undefined };
    const name = declaredName(pr);
    if (!name) {
      if (missing === "require") throw new PayeeRefused("payee-name: the 402 declares no payee name and one is required", null);
      return;
    }

    const origin = toOrigin(ctx.resource);
    if (!origin) throw new PayeeRefused(`payee-name: cannot check ${name}: the requested URL is not http(s)`, null);

    const verdicts = await abortable(verifyPayee(pr, origin, reader), ctx.signal);
    const v = verdicts?.[0];
    if (!v) throw new PayeeRefused(`payee-name: no verdict for ${name}`, null);
    onVerdict?.(v, ctx);

    if (v.verdict === true) return;
    if (v.verdict === "inconclusive" && inconclusive === "allow") return;
    const what = v.verdict === false ? "does not hold" : "could not be checked";
    throw new PayeeRefused(`payee-name: ${name} ${what} for ${origin} (${v.reason})`, v);
  };
}
