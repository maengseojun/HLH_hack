import { Contract, Wallet, ethers } from 'ethers';
import { config } from '../config.js';
import { provider } from '../services/onchain.js';

const CORE_WRITER_ABI = [
  'function sendRawAction(bytes data) external',
] as const;

class NonceQueue {
  private chain = Promise.resolve<void>(undefined);
  private nextNonce?: number;

  constructor(private readonly address: string) {}

  run<T>(task: (nonce: number) => Promise<T>): Promise<T> {
    let resolveTask: (value: T) => void;
    let rejectTask: (reason?: unknown) => void;

    const result = new Promise<T>((resolve, reject) => {
      resolveTask = resolve;
      rejectTask = reject;
    });

    this.chain = this.chain.then(async () => {
      try {
        const nonce = this.nextNonce ?? (await provider.getTransactionCount(this.address, 'latest'));
        const output = await task(nonce);
        this.nextNonce = nonce + 1;
        resolveTask(output);
      } catch (error) {
        rejectTask(error);
      }
    }).catch(() => {
      // keep queue alive even if prior task failed
    });

    return result;
  }
}

export class CoreWriter {
  private readonly wallet: Wallet;
  private readonly contract: Contract;
  private readonly nonceQueue: NonceQueue;

  constructor(privateKey: string) {
    this.wallet = new Wallet(privateKey, provider);
    this.contract = new Contract(
      config.hypercore.coreWriterAddress,
      CORE_WRITER_ABI,
      this.wallet,
    );
    this.nonceQueue = new NonceQueue(this.wallet.address);
  }

  async sendRawAction(data: string): Promise<ethers.providers.TransactionResponse> {
    const feeData = await provider.getFeeData();
    return this.nonceQueue.run(async (nonce) => {
      return this.contract.sendRawAction(data, {
        nonce,
        maxFeePerGas: feeData.maxFeePerGas ?? undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
      });
    });
  }
}
