"use client";

import { usePrivy } from "@privy-io/react-auth";
import type { LinkedAccountWithMetadata } from "@privy-io/react-auth";

type LinkedWallet = Extract<LinkedAccountWithMetadata, { type: "wallet" }>;

function isLinkedWalletWithAddress(account: LinkedAccountWithMetadata): account is LinkedWallet & { address: string } {
  return account.type === "wallet" && typeof (account as { address?: unknown }).address === "string";
}

export default function HeaderWalletButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  const linkedWallet = user?.linkedAccounts?.find(isLinkedWalletWithAddress);
  const addr = user?.wallet?.address ?? linkedWallet?.address ?? null;
  const short = addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  if (!ready) {
    return (
      <button className="glass-input rounded-[12px] px-3 py-1.5 text-[color:var(--color-secondary)] opacity-60" disabled>
        Loading…
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="glass-input rounded-[12px] px-3 py-1.5 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-white hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <button
      onClick={logout}
      className="glass-input rounded-[12px] px-3 py-1.5 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-white hover:-translate-y-1 hover:shadow-lg transition-all duration-200"
      title="Click to disconnect"
    >
      {short || "Connected"}
    </button>
  );
}
