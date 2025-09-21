import { ethers } from 'ethers';
import { provider } from '../services/onchain.js';
import { PRECOMPILE } from './addresses.js';
import { AppError } from '../utils/httpError.js';

const coder = ethers.utils.defaultAbiCoder;

const decodeError = (message: string, details?: unknown) =>
  new AppError(503, { code: 'PRECOMPILE_PARSE_ERROR', message, details });

export async function readPerpPosition(user: string, assetId: number) {
  try {
    const data = coder.encode(['address', 'uint32'], [user, assetId]);
    const raw = await provider.call({ to: PRECOMPILE.POSITIONS, data });
    const decoded = coder.decode(['int64', 'uint32', 'uint64'], raw);
    const szi = (decoded[0] as ethers.BigNumber).fromTwos(64).toBigInt();
    const leverage = Number((decoded[1] as ethers.BigNumber).toNumber());
    const entryNtl = (decoded[2] as ethers.BigNumber).toBigInt();
    return { szi, leverage, entryNtl };
  } catch (error) {
    throw decodeError('Failed to read perp position', { assetId, error: `${error}` });
  }
}

export async function readSpotBalance(user: string, tokenId: bigint) {
  try {
    const data = coder.encode(['address', 'uint64'], [user, tokenId.toString()]);
    const raw = await provider.call({ to: PRECOMPILE.SPOT_BALANCE, data });
    const decoded = coder.decode(['uint64', 'uint64', 'uint64'], raw);
    return {
      total: (decoded[0] as ethers.BigNumber).toBigInt(),
      hold: (decoded[1] as ethers.BigNumber).toBigInt(),
      entryNtl: (decoded[2] as ethers.BigNumber).toBigInt(),
    };
  } catch (error) {
    throw decodeError('Failed to read spot balance', { tokenId: tokenId.toString(), error: `${error}` });
  }
}

export async function readOraclePx(assetId: number) {
  try {
    const data = coder.encode(['uint32'], [assetId]);
    const raw = await provider.call({ to: PRECOMPILE.ORACLE_PRICE, data });
    const decoded = coder.decode(['uint64'], raw);
    return (decoded[0] as ethers.BigNumber).toBigInt();
  } catch (error) {
    throw decodeError('Failed to read oracle price', { assetId, error: `${error}` });
  }
}

export async function readSpotPx(tokenId: number) {
  try {
    const data = coder.encode(['uint32'], [tokenId]);
    const raw = await provider.call({ to: PRECOMPILE.SPOT_PRICE, data });
    const decoded = coder.decode(['uint64'], raw);
    return (decoded[0] as ethers.BigNumber).toBigInt();
  } catch (error) {
    throw decodeError('Failed to read spot price', { tokenId, error: `${error}` });
  }
}
