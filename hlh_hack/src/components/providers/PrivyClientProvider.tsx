"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import React from "react";

export default function PrivyClientProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    return <>{children}</>; // fail open in dev if env missing
  }
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#98FCE4",
        },
        // Keep defaults lightweight for hackathon
        embeddedWallets: { createOnLogin: "users-without-wallets" },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

