type QueuedJob<T> = {
  job: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: any) => void;
};

class WalletQueue {
  private queues = new Map<string, QueuedJob<any>[]>();
  private processing = new Set<string>();

  async execute<T>(walletAddress: string, job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedJob: QueuedJob<T> = { job, resolve, reject };

      if (!this.queues.has(walletAddress)) {
        this.queues.set(walletAddress, []);
      }

      this.queues.get(walletAddress)!.push(queuedJob);
      this.processQueue(walletAddress);
    });
  }

  private async processQueue(walletAddress: string): Promise<void> {
    if (this.processing.has(walletAddress)) {
      return; // Already processing this wallet's queue
    }

    this.processing.add(walletAddress);

    try {
      const queue = this.queues.get(walletAddress);
      if (!queue) return;

      while (queue.length > 0) {
        const queuedJob = queue.shift()!;

        try {
          const result = await queuedJob.job();
          queuedJob.resolve(result);
        } catch (error) {
          queuedJob.reject(error);
        }
      }
    } finally {
      this.processing.delete(walletAddress);

      // Clean up empty queues
      const queue = this.queues.get(walletAddress);
      if (queue && queue.length === 0) {
        this.queues.delete(walletAddress);
      }
    }
  }

  getQueueLength(walletAddress: string): number {
    return this.queues.get(walletAddress)?.length || 0;
  }

  isProcessing(walletAddress: string): boolean {
    return this.processing.has(walletAddress);
  }

  getStats() {
    return {
      totalQueues: this.queues.size,
      processing: this.processing.size,
      queueLengths: Array.from(this.queues.entries()).map(([addr, queue]) => ({
        address: addr,
        length: queue.length,
      })),
    };
  }
}

export const walletQueue = new WalletQueue();