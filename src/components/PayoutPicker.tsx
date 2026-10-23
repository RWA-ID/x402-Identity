"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { usePublicClient } from "wagmi";
import { base, mainnet } from "wagmi/chains";
import type { Address, PublicClient } from "viem";
import { EXTRA_CHAINS, solanaOk, walletKind, type Payout } from "@/lib/payout";

type Props = {
  address: Address;
  value: Payout;
  /** A state setter: the wallet check resolves later and must not overwrite edits made meanwhile. */
  onChange: Dispatch<SetStateAction<Payout>>;
  disabled?: boolean;
};

/**
 * Where the name says you get paid. Ethereum and Base are always written; the
 * default EVM address (every other EVM chain) is offered only once the wallet
 * reads as an EOA on Ethereum and Base, and starts on for one.
 */
export function PayoutPicker({ address, value, onChange, disabled }: Props) {
  const eth = usePublicClient({ chainId: mainnet.id });
  const bas = usePublicClient({ chainId: base.id });
  const [kind, setKind] = useState<"checking" | "eoa" | "contract" | "unknown">("checking");
  const touched = useRef(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!eth || !bas) return;
    let cancel = false;
    setKind("checking");
    walletKind([eth, bas] as PublicClient[], address).then((k) => {
      if (cancel) return;
      setKind(k);
      // The default record is only safe for an EOA: never leave it on otherwise.
      if (k !== "eoa") onChange((v) => ({ ...v, defaultEvm: false }));
      else if (!touched.current) onChange((v) => ({ ...v, defaultEvm: true }));
    });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, eth, bas]);

  const update = (p: Partial<Payout>) => {
    touched.current = true;
    onChange((v) => ({ ...v, ...p }));
  };
  const toggleChain = (id: number) => {
    touched.current = true;
    onChange((v) => ({ ...v, chains: v.chains.includes(id) ? v.chains.filter((c) => c !== id) : [...v.chains, id] }));
  };

  return (
    <div className="payout">
      <p className="payout-head">Where do you get paid?</p>

      <label className="payout-row payout-fixed">
        <input type="checkbox" checked disabled />
        <span>
          Ethereum and Base <span className="payout-mono">{address.slice(0, 6)}…{address.slice(-4)}</span>
        </span>
      </label>

      <label className="payout-row" data-off={kind !== "eoa"}>
        <input
          type="checkbox"
          checked={value.defaultEvm}
          disabled={disabled || kind !== "eoa"}
          onChange={(e) => update({ defaultEvm: e.target.checked })}
        />
        <span>
          Every other EVM chain, same address
          <span className="payout-note">
            {kind === "checking"
              ? "Checking your wallet…"
              : kind === "eoa"
                ? "One record covers Polygon, Arbitrum, Robinhood Chain and any chain added later."
                : kind === "contract"
                  ? "Not available for a smart-contract wallet: its address may belong to someone else on chains where it isn't deployed. Pick chains below instead."
                  : "Couldn't check your wallet type, so this stays off. Pick chains below instead."}
          </span>
        </span>
      </label>

      <button type="button" className="payout-more" onClick={() => setMore((m) => !m)} aria-expanded={more}>
        {more ? "Hide" : "Add"} chain-specific records{value.chains.length ? ` (${value.chains.length})` : ""}
      </button>
      {more && (
        <div className="payout-chains">
          {EXTRA_CHAINS.map((c) => (
            <label key={c.id} className="payout-chip" data-on={value.chains.includes(c.id)}>
              <input
                type="checkbox"
                checked={value.chains.includes(c.id)}
                disabled={disabled}
                onChange={() => toggleChain(c.id)}
              />
              {c.label}
            </label>
          ))}
          <p className="payout-note">Wallets that don&apos;t read the default address see these.</p>
        </div>
      )}

      <div className="payout-sol">
        <input
          className="label-input"
          placeholder="Solana payout address (optional)"
          autoComplete="off"
          spellCheck={false}
          value={value.solana}
          disabled={disabled}
          onChange={(e) => update({ solana: e.target.value.trim() })}
        />
        {!solanaOk(value) && <p className="payout-error">Not a Solana address.</p>}
      </div>
    </div>
  );
}
