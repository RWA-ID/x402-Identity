"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Catches stale WalletConnect pairing errors that surface as unhandled runtime errors.
 * These occur when a WC pairing is deleted on the relay side but still cached locally.
 * Recovery: clear the stale wc@2 localStorage keys and reload.
 */
export class WalletConnectErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    if (error?.message?.includes("pairing") || error?.message?.includes("Missing or invalid")) {
      // Clear stale WalletConnect state
      if (typeof window !== "undefined") {
        Object.keys(localStorage)
          .filter((k) => k.startsWith("wc@2:") || k.startsWith("wagmi"))
          .forEach((k) => localStorage.removeItem(k));
      }
      return { hasError: true };
    }
    throw error; // re-throw non-WC errors
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a0a]">
          <div className="text-center p-8">
            <p className="font-mono text-[#f97316] mb-2">Wallet session expired</p>
            <p className="font-mono text-sm text-[#666] mb-4">Cleared stale connection. Please reconnect.</p>
            <button
              onClick={this.handleReload}
              className="font-mono text-sm border border-[#f97316] text-[#f97316] px-4 py-2 rounded hover:bg-[rgba(249,115,22,0.1)]"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
