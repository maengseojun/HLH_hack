import { ethers } from 'ethers';

const { utils } = ethers;

export async function verifyUserSignature(params: {
  expectedAddress: string;
  message: string;
  signature: string;
}): Promise<boolean> {
  const recovered = await utils.verifyMessage(params.message, params.signature);
  return utils.getAddress(recovered) === utils.getAddress(params.expectedAddress);
}

export function buildPrecheckMessage(user: string, nonceSec: number): string {
  return `HyperIndex Payment: precheck\nuser:${utils.getAddress(user)}\nnonce:${nonceSec}`;
}

export function buildIntentsMessage(
  user: string,
  recipient: string,
  amountInt: string,
  currency: string,
  nonceSec: number,
): string {
  return [
    'HyperIndex Payment: intent',
    `user:${utils.getAddress(user)}`,
    `recipient:${utils.getAddress(recipient)}`,
    `amount:${amountInt}`,
    `currency:${currency}`,
    `nonce:${nonceSec}`,
  ].join('\n');
}
