"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import type { MintRow } from "@/types";

type SuccessModalProps = {
  minted: MintRow[];
  onClose: () => void;
};

export function SuccessModal({ minted, onClose }: SuccessModalProps) {
  const names = minted.map((r) => `${r.label}.${r.parent.label}`);

  const tweetText = encodeURIComponent(
    names.length === 1
      ? `Just minted ${names[0]} on @x402identity's x402 Identity Hub! 🤖⚡\n\nYour ENS subdomain as an AI agent identity — fully onchain, permanent.\n\nMint yours 👇 https://x402id.eth.link\n\n#x402 #ENS #AIagents #Web3 #Ethereum`
      : `Just minted ${names.length} ENS subnames on @x402identity's x402 Identity Hub! 🤖⚡\n\n${names.join(" · ")}\n\nMint yours 👇 https://x402id.eth.link\n\n#x402 #ENS #AIagents #Web3 #Ethereum`
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#111] border border-[#1f1f1f] rounded-2xl p-6 shadow-[0_0_60px_rgba(249,115,22,0.2)]"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="text-5xl mb-3"
          >
            🎉
          </motion.div>
          <h2 className="font-mono text-xl font-bold text-[#f97316]">Successfully Minted!</h2>
          <p className="text-sm text-[#666] mt-1 font-mono">Your ENS subnames are live onchain</p>
        </div>

        {/* Minted names */}
        <div className="space-y-2 mb-5">
          {names.map((name) => (
            <div
              key={name}
              className="flex items-center justify-between p-3 bg-[#0a0a0a] border border-[#f97316]/20 rounded-lg group"
            >
              <span className="font-mono text-[#f0f0f0] text-sm">{name}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(name)}
                  className="text-xs font-mono text-[#444] hover:text-[#f97316] transition-colors"
                >
                  Copy
                </button>
                <a
                  href={`https://app.ens.domains/${name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-[#444] hover:text-[#f97316] transition-colors"
                >
                  ENS ↗
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Share & promo */}
        <a
          href={`https://twitter.com/intent/tweet?text=${tweetText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <Button size="lg" className="w-full mb-3">
            Share on X (Twitter)
          </Button>
        </a>

        <div className="p-3 bg-[rgba(249,115,22,0.05)] border border-[#f97316]/20 rounded-lg mb-4 text-center">
          <p className="text-xs font-mono text-[#f97316]">
            🎁 Share your tweet & qualify for ONE free additional subdomain!
          </p>
          <p className="text-xs font-mono text-[#666] mt-1">
            DM or reply to <span className="text-[#f97316]">@x402identity</span> to claim.
            First come, first served.
          </p>
        </div>

        <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>
          Mint More
        </Button>
      </motion.div>
    </div>
  );
}
