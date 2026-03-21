"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/Button";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-[#f97316] border border-[#f97316]/30 px-3 py-1.5 rounded bg-[rgba(249,115,22,0.05)]">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <Button variant="secondary" size="sm" onClick={() => disconnect()}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button onClick={() => setOpen((v) => !v)} size="md">
        Connect Wallet
      </Button>
      {open && (
        <div className="absolute right-0 top-12 z-50 bg-[#111] border border-[#2a2a2a] rounded-xl p-2 min-w-[180px] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => {
                connect({ connector });
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 font-mono text-sm text-[#ccc] hover:text-[#f97316] hover:bg-[rgba(249,115,22,0.07)] rounded-lg transition-colors"
            >
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
