"use client";

import { usePrivy } from "@privy-io/react-auth";

export default function HeaderWalletButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();

  const addr = user?.wallet?.address || user?.linkedAccounts?.find((a: any) => a.type === "wallet")?.address;
  const short = addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  if (!ready) {
    return (
      <button className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-1.5 text-[color:var(--color-secondary)] opacity-60" disabled>
        Loading…
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-1.5 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <button
      onClick={logout}
      className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-1.5 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]"
      title="Click to disconnect"
    >
      {short || "Connected"}
    </button>
  );
}

