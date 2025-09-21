import { provider } from '../services/onchain.js';
import { ethers } from 'ethers';

export async function tryGetRevertReason(txHash: string): Promise<string | null> {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx || tx.blockNumber == null) {
      return null;
    }

    try {
      await provider.call({
        to: tx.to ?? undefined,
        from: tx.from,
        data: tx.data,
        value: tx.value,
      }, tx.blockNumber);
      return null;
    } catch (error) {
      const err = error as any;
      const reason = err?.reason ?? err?.error?.message ?? err?.message;
      if (typeof reason === 'string') {
        return reason;
      }
      if (err?.data) {
        try {
          return ethers.utils.toUtf8String(err.data.slice(138));
        } catch {}
      }
      return null;
    }
  } catch {
    return null;
  }
}
