"use client";

import { motion } from "framer-motion";
import { ConnectButton } from "@/components/ConnectButton";
import { MintForm } from "@/components/MintForm";
import { RecentMints } from "@/components/RecentMints";

export default function Home() {
  return (
    <div className="relative min-h-screen">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[rgba(249,115,22,0.06)] blur-[80px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-[#1f1f1f] bg-[rgba(10,10,10,0.8)] backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg font-bold text-[#f97316]">x402</span>
            <span className="font-mono text-sm text-[#444]">/</span>
            <span className="font-mono text-sm text-[#666]">identity hub</span>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 border border-[#f97316]/30 bg-[rgba(249,115,22,0.05)] px-3 py-1 rounded-full mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-pulse" />
            <span className="font-mono text-xs text-[#f97316]">Live on Ethereum</span>
          </div>

          <h1 className="font-mono text-3xl sm:text-4xl font-bold text-[#f0f0f0] mb-4 leading-tight">
            Your AI Agent&apos;s<br />
            <span className="text-[#f97316]">ENS Identity</span>
          </h1>

          <p className="text-[#666] text-base max-w-md mx-auto">
            Mint permanent ENS subnames under{" "}
            <span className="font-mono text-[#888]">402bot.eth</span>,{" "}
            <span className="font-mono text-[#888]">402api.eth</span>, or{" "}
            <span className="font-mono text-[#888]">402mcp.eth</span>.
            Fully onchain. 0.005 ETH per name.
          </p>
        </motion.div>

        {/* Main mint card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]"
        >
          <MintForm />
        </motion.div>

        {/* Recent mints feed */}
        <RecentMints />

        {/* Footer info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-10 pt-6 border-t border-[#1a1a1a] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-[#444]"
        >
          <div className="flex gap-4">
            <span>x402id.eth</span>
            <span className="text-[#2a2a2a]">·</span>
            <a
              href="https://twitter.com/x402identity"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#f97316] transition-colors"
            >
              @x402identity
            </a>
            <span className="text-[#2a2a2a]">·</span>
            <a
              href="https://github.com/RWA-ID/x402-Identity"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#f97316] transition-colors"
            >
              GitHub ↗
            </a>
          </div>
          <div className="flex gap-4">
            <a
              href="https://app.ens.domains"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#f97316] transition-colors"
            >
              ENS Manager ↗
            </a>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
