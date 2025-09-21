import { AppError } from '../utils/httpError.js';
import { ethers } from 'ethers';

export interface WalletRecord {
  indexId: string;
  address: string;
  privkey: string;
}

const registry = new Map<string, WalletRecord>();

export function registerWallet(record: WalletRecord): void {
  const address = ethers.utils.getAddress(record.address);
  registry.set(record.indexId, { ...record, address });
}

export function getWallet(indexId: string): WalletRecord {
  const record = registry.get(indexId);
  if (!record) {
    throw new AppError(400, { code: 'WALLET_NOT_REGISTERED', message: `Wallet not registered for index ${indexId}` });
  }
  return record;
}

export function hasWallet(indexId: string): boolean {
  return registry.has(indexId);
}

export function clearWallets(): void {
  registry.clear();
}
