import { ethers } from 'ethers';

const { utils } = ethers;

const ENCODING_VERSION = 0x01;
const RESERVED0 = 0x00;
const RESERVED1 = 0x00;

export const ActionId = {
  LIMIT_ORDER: 0x01,
  USD_CLASS_TRANSFER: 0x07,
} as const;

export type Tif = 0 | 1 | 2;

export const MAX_UINT64 = 2n ** 64n - 1n;
export const MAX_UINT128 = 2n ** 128n - 1n;

function assertUint(value: bigint, max: bigint, label: string): void {
  if (value < 0n || value > max) {
    throw new RangeError(`${label} exceeds allowed range`);
  }
}

export function assertUint64(value: bigint, label: string): void {
  assertUint(value, MAX_UINT64, label);
}

export function assertUint128(value: bigint, label: string): void {
  assertUint(value, MAX_UINT128, label);
}

function toBigNumberish(value: bigint): ethers.BigNumber {
  return ethers.BigNumber.from(value.toString());
}

function withHeader(actionId: number, encodedParams: string): string {
  const paramsBytes = utils.arrayify(encodedParams);
  const out = new Uint8Array(4 + paramsBytes.length);
  out[0] = ENCODING_VERSION;
  out[1] = RESERVED0;
  out[2] = RESERVED1;
  out[3] = actionId;
  out.set(paramsBytes, 4);
  return utils.hexlify(out);
}

export function toBytes32Symbol(symbol: string): string {
  const coin = symbol.replace('-PERP', '').toUpperCase();
  const buf = Buffer.alloc(32);
  buf.write(coin);
  return `0x${buf.toString('hex')}`;
}

export function randomCloid(): bigint {
  const rand = utils.randomBytes(32);
  const hash = utils.keccak256(rand);
  return BigInt(hash);
}

export function encLimitOrder(params: {
  assetId: number;
  isBuy: boolean;
  limitPxRaw: bigint;
  sizeRaw: bigint;
  reduceOnly: boolean;
  tif: Tif;
  cloid?: bigint;
}): string {
  assertUint64(params.limitPxRaw, 'limitPxRaw');
  assertUint64(params.sizeRaw, 'sizeRaw');
  const cloid = params.cloid ?? randomCloid();
  assertUint128(cloid, 'cloid');

  const encoded = utils.defaultAbiCoder.encode(
    ['uint32', 'bool', 'uint64', 'uint64', 'bool', 'uint8', 'uint128'],
    [
      params.assetId,
      params.isBuy,
      toBigNumberish(params.limitPxRaw),
      toBigNumberish(params.sizeRaw),
      params.reduceOnly,
      params.tif,
      toBigNumberish(cloid),
    ],
  );

  return withHeader(ActionId.LIMIT_ORDER, encoded);
}

export function encUsdClassTransfer(ntlRaw: bigint, toPerp: boolean): string {
  assertUint64(ntlRaw, 'ntlRaw');
  const encoded = utils.defaultAbiCoder.encode(
    ['uint64', 'bool'],
    [toBigNumberish(ntlRaw), toPerp],
  );
  return withHeader(ActionId.USD_CLASS_TRANSFER, encoded);
}
