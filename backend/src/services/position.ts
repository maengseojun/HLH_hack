import { AppError } from '../utils/httpError.js';
import { CoreWriter } from '../corewriter/writer.js';
import { encLimitOrder } from '../corewriter/actions.js';
import { humanPxToRaw, humanSzToRaw, rawPxToHuman, rawSzToHuman, roundQtyToStep } from '../corewriter/scales.js';
import { swr } from '../precompile/swr.js';
import { readOraclePx, readPerpPosition } from '../precompile/readers.js';
import { getWallet } from './walletRegistry.js';
import { resolveInstrument } from './meta.js';
import { config } from '../config.js';
import { provider } from './onchain.js';

export async function precheckOpen(indexId: string, params: {
  symbol: string;
  side: 'LONG' | 'SHORT';
  leverage: number;
  notionalUsd: number;
  slippageBps: number;
}) {
  const instrument = await resolveInstrument(params.symbol);

  const maxLev = instrument.maxLeverage ?? config.hypercore.maxLeverage;
  if (params.leverage > maxLev) {
    throw new AppError(400, { code: 'LEVERAGE_EXCEEDED', message: `Max leverage ${maxLev}` });
  }
  if (params.notionalUsd < config.hypercore.minNotionalUsd) {
    throw new AppError(400, { code: 'SIZE_TOO_SMALL', message: `Min notional ${config.hypercore.minNotionalUsd}` });
  }

  const rawPx = await swr(`oracle:${instrument.assetId}`, () => readOraclePx(instrument.assetId), 400);
  const markPx = rawPxToHuman(rawPx, instrument.priceDecimals);

  const targetQty = params.notionalUsd / markPx;
  const qtyHuman = roundQtyToStep(targetQty, instrument.szDecimals);
  if (qtyHuman <= 0) {
    throw new AppError(400, { code: 'SIZE_TOO_SMALL', message: `Minimum size step is 1e-${instrument.szDecimals}` });
  }

  return {
    ok: true,
    markPx,
    qtyHuman,
    instrument,
    indexId,
  };
}

export async function openPosition(indexId: string, params: {
  symbol: string;
  side: 'LONG' | 'SHORT';
  leverage: number;
  notionalUsd: number;
  slippageBps: number;
}) {
  const pre = await precheckOpen(indexId, params);
  const wallet = getWallet(indexId);
  const isBuy = params.side === 'LONG';

  const slippage = params.slippageBps / 10_000;
  const limitHuman = isBuy ? pre.markPx * (1 + slippage) : pre.markPx * (1 - slippage);
  if (limitHuman <= 0) {
    throw new AppError(400, { code: 'PX_BAND_EXCEEDED', message: 'Invalid limit price' });
  }

  const limitPxRaw = humanPxToRaw(limitHuman, pre.instrument.priceDecimals);
  const sizeRaw = humanSzToRaw(pre.qtyHuman, pre.instrument.szDecimals);

  const data = encLimitOrder({
    assetId: pre.instrument.assetId,
    isBuy,
    limitPxRaw,
    sizeRaw,
    reduceOnly: false,
    tif: 0,
  });

  const writer = new CoreWriter(wallet.privkey);
  const tx = await writer.sendRawAction(data);

  return {
    status: 'SUBMITTED',
    txHash: tx.hash,
    requested: {
      symbol: params.symbol,
      side: params.side,
      leverage: params.leverage,
      qty: pre.qtyHuman,
      limit: limitHuman,
    },
  };
}

export async function closePosition(indexId: string, params: {
  symbol: string;
  closePercent?: number;
  slippageBps: number;
}) {
  const instrument = await resolveInstrument(params.symbol);
  const wallet = getWallet(indexId);

  const position = await readPerpPosition(wallet.address, instrument.assetId);
  if (position.szi === 0n) {
    throw new AppError(400, { code: 'INSUFFICIENT_POSITION', message: 'No position to close' });
  }

  const closePct = Math.min(Math.max(params.closePercent ?? 100, 0), 100) / 100;
  const absQtyHuman = rawSzToHuman(position.szi < 0n ? -position.szi : position.szi, instrument.szDecimals);
  const targetQty = roundQtyToStep(absQtyHuman * closePct, instrument.szDecimals);
  if (targetQty <= 0) {
    throw new AppError(400, { code: 'SIZE_TOO_SMALL', message: `Minimum close step is 1e-${instrument.szDecimals}` });
  }
  if (targetQty > absQtyHuman) {
    throw new AppError(400, {
      code: 'INSUFFICIENT_POSITION',
      message: 'Close quantity exceeds position size',
      details: { have: absQtyHuman, requested: targetQty },
    });
  }

  const isBuy = position.szi < 0n;
  const rawPx = await swr(`oracle:${instrument.assetId}`, () => readOraclePx(instrument.assetId), 400);
  const markPx = rawPxToHuman(rawPx, instrument.priceDecimals);

  const slippage = params.slippageBps / 10_000;
  const limitHuman = isBuy ? markPx * (1 + slippage) : markPx * (1 - slippage);
  if (limitHuman <= 0) {
    throw new AppError(400, { code: 'PX_BAND_EXCEEDED', message: 'Invalid limit price' });
  }

  const limitPxRaw = humanPxToRaw(limitHuman, instrument.priceDecimals);
  const sizeRaw = humanSzToRaw(targetQty, instrument.szDecimals);

  const data = encLimitOrder({
    assetId: instrument.assetId,
    isBuy,
    limitPxRaw,
    sizeRaw,
    reduceOnly: true,
    tif: 0,
  });

  const writer = new CoreWriter(wallet.privkey);
  const tx = await writer.sendRawAction(data);

  return {
    status: 'SUBMITTED',
    txHash: tx.hash,
    requested: {
      symbol: params.symbol,
      closeQty: targetQty,
      limit: limitHuman,
    },
  };
}

export async function waitForFill(txHash: string, assetId: number, userAddress: string, timeoutMs = 10_000) {
  const receipt = await provider.waitForTransaction(txHash, 1, timeoutMs);
  if (!receipt || receipt.status === 0) {
    throw new AppError(400, { code: 'ONCHAIN_REVERT', message: 'Transaction reverted or not found' });
  }
  const position = await readPerpPosition(userAddress, assetId);
  return { receipt, position };
}
