// types/privy.d.ts
declare module '@privy-io/react-auth' {
  interface Email {
    address: string;
    verified?: boolean;
  }

  interface ConnectedWallet {
    address: string;
    chainType?: string;
    walletClientType?: string;
    connectorType?: string;
    delegated?: boolean;
    imported?: boolean;
    id?: string;
  }

  interface LinkedAccountWithMetadata {
    address?: string;
    chainType?: string;
    walletClientType?: string;
    connectorType?: string;
    delegated?: boolean;
    imported?: boolean;
    id?: string;
  }

  interface SmartWalletWithMetadata {
    address: string;
    chainType?: string;
    walletClientType?: string;
    connectorType?: string;
    delegated?: boolean;
    imported?: boolean;
    id?: string;
  }
}
