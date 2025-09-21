export type PaymentIntentStatus = 'CREATED' | 'SUCCESS';

export interface PaymentIntentRecord {
  intentId: string;
  user: string;
  recipient: string;
  amount: string;
  status: PaymentIntentStatus;
  createdAt: number;
  txHash?: string;
}

const intents = new Map<string, PaymentIntentRecord>();

export function find(intentId: string): PaymentIntentRecord | undefined {
  return intents.get(intentId);
}

export function save(record: PaymentIntentRecord): void {
  intents.set(record.intentId, { ...record });
}

export function update(intentId: string, patch: Partial<PaymentIntentRecord>): void {
  const current = intents.get(intentId);
  if (!current) return;
  intents.set(intentId, { ...current, ...patch });
}

export function clear(): void {
  intents.clear();
}
