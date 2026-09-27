"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { mainnet } from "wagmi/chains";
import { useAppKit } from "@reown/appkit/react";
import { getAddress, namehash, type Address, type Hex } from "viem";
import { getAddressStatus, type AddressStatus } from "@x402identity/widget-core";
import { ADDRESSES } from "@/lib/contracts";
import { PARENTS } from "@/lib/parents";
import { useSetAddress } from "@/hooks/useSetAddress";

const NAME_WRAPPER_ABI = [
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

type Lookup =
  | { kind: "idle" }
  | { kind: "loading" }
  // A failed read is not "unlinked" — a throttled RPC must never look like an empty record.
  | { kind: "error"; message: string }
  | { kind: "unminted" }
  | { kind: "ok"; owner: Address; status: AddressStatus };

function short(a: string | null | undefined) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "not set";
}

function parseName(raw: string): { name: string; node: Hex } | null {
  const name = raw.trim().toLowerCase();
  const parent = PARENTS.find((p) => name.endsWith(`.${p.label}`));
  if (!parent) return null;
  const label = name.slice(0, -(parent.label.length + 1));
  if (label.length < 3 || !/^[a-z0-9-]+$/.test(label)) return null;
  return { name, node: namehash(name) };
}

export function SetAddressPanel() {
  const { open: openAppKit } = useAppKit();
  const { address, isConnected } = useAccount();
  const client = usePublicClient({ chainId: mainnet.id });
  const link = useSetAddress();

  const [input, setInput] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ kind: "idle" });
  const [refresh, setRefresh] = useState(0);
  const parsed = parseName(input);
  const node = parsed?.node;

  useEffect(() => {
    link.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);

  useEffect(() => {
    if (link.state === "linked") setRefresh((n) => n + 1);
  }, [link.state]);

  useEffect(() => {
    if (!node || !client || !address) {
      setLookup({ kind: "idle" });
      return;
    }
    let cancel = false;
    setLookup({ kind: "loading" });
    const t = setTimeout(async () => {
      try {
        const owner = (await client.readContract({
          address: ADDRESSES.mainnet.nameWrapper,
          abi: NAME_WRAPPER_ABI,
          functionName: "ownerOf",
          args: [BigInt(node)],
        })) as Address;
        if (cancel) return;
        if (BigInt(owner) === 0n) {
          setLookup({ kind: "unminted" });
          return;
        }
        const status = await getAddressStatus(client, node, address);
        if (!cancel) setLookup({ kind: "ok", owner: getAddress(owner), status });
      } catch (e) {
        if (!cancel) setLookup({ kind: "error", message: errorMessage(e) ?? "Lookup failed" });
      }
    }, 350);
    return () => {
      cancel = true;
      clearTimeout(t);
    };
  }, [node, client, address, refresh]);

  const isOwner = lookup.kind === "ok" && address != null && lookup.owner === getAddress(address);
  const busy = link.state === "signing" || link.state === "confirming";

  let state: "idle" | "checking" | "available" | "taken" | "invalid" = "idle";
  let text = "Enter a name you own, e.g. myagent.402bot.eth";
  if (input.trim() && !parsed) {
    state = "invalid";
    text = "Enter a full name under 402bot.eth, 402api.eth or 402mcp.eth";
  } else if (parsed && !isConnected) {
    text = "Connect the wallet that owns this name";
  } else if (lookup.kind === "loading") {
    state = "checking";
    text = `Reading records · ${parsed?.name}`;
  } else if (lookup.kind === "error") {
    state = "invalid";
    text = `Couldn't read records, try again · ${lookup.message.slice(0, 80)}`;
  } else if (lookup.kind === "unminted") {
    state = "invalid";
    text = `${parsed?.name} hasn't been minted`;
  } else if (lookup.kind === "ok" && !isOwner) {
    state = "invalid";
    text = `Owned by ${short(lookup.owner)}. Connect that wallet to set its address.`;
  } else if (lookup.kind === "ok" && lookup.status.linked) {
    state = "available";
    text = `${parsed?.name} resolves to your wallet on Ethereum and Base`;
  } else if (lookup.kind === "ok") {
    state = "taken";
    text = `${parsed?.name} doesn't resolve to your wallet yet`;
  }

  return (
    <div className="set-address">
      <div className="input-row">
        <input
          className="label-input"
          type="text"
          placeholder="myagent.402bot.eth"
          autoComplete="off"
          spellCheck={false}
          value={input}
          onChange={(e) => setInput(e.target.value.toLowerCase())}
        />
      </div>
      <div className="avail" data-state={state}>
        <span className="ad" />
        <span>{text}</span>
      </div>

      {lookup.kind === "ok" && isOwner && (
        <div className="fuse-list" style={{ marginTop: 14 }}>
          <div className="fuse-row">
            <div className="k">ETHEREUM</div>
            <div className="v">{short(lookup.status.eth)}</div>
          </div>
          <div className="fuse-row">
            <div className="k">BASE · ANY EVM</div>
            <div className="v">{short(lookup.status.defaultEvm)}</div>
          </div>
        </div>
      )}

      {!isConnected ? (
        <button className="btn btn-ghost" style={{ width: "100%", marginTop: 14 }} onClick={() => openAppKit()}>
          Connect wallet <span className="arrow">→</span>
        </button>
      ) : (
        <button
          className="btn btn-ghost"
          style={{ width: "100%", marginTop: 14 }}
          disabled={!parsed || !isOwner || busy || (lookup.kind === "ok" && lookup.status.linked)}
          onClick={() => parsed && link.setAddress([parsed.node])}
        >
          {link.state === "signing"
            ? "Confirm in wallet…"
            : link.state === "confirming"
              ? "Confirming on-chain…"
              : lookup.kind === "ok" && lookup.status.linked
                ? "Already set"
                : "Set my address"}
        </button>
      )}

      {link.error && (
        <p style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 11, color: "#B0413E" }}>
          {link.error.slice(0, 120)}
        </p>
      )}
    </div>
  );
}

function errorMessage(e: unknown): string | undefined {
  const err = e as { shortMessage?: string; message?: string } | null;
  return err?.shortMessage ?? err?.message;
}
