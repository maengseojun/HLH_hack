import { Router } from 'express';
import { z } from 'zod';
import { ethers } from 'ethers';
import { AppError } from '../utils/httpError.js';
import { precheck } from '../services/balance.js';
import { buildIntentsMessage, buildPrecheckMessage, verifyUserSignature } from '../utils/crypto.js';
import { buildIntentId, provider } from '../services/onchain.js';
import { config } from '../config.js';
import { find, save, update } from '../repositories/paymentsRepo.js';
import { tryGetRevertReason } from '../utils/revert.js';

const { utils } = ethers;

const paymentsRouter = Router();

const precheckSchema = z.object({
  user: z.string().min(42),
  amount: z.string().regex(/^\d+$/),
  currency: z.literal('USDC'),
  recipient: z.string().min(42),
  nonceSec: z.number().int().positive(),
  signature: z.string().min(10),
});

const intentSchema = precheckSchema;

const confirmSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

function ensureBigInt(value: string, label: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new AppError(400, { code: 'BAD_REQUEST', message: `Invalid ${label}` });
  }
}

paymentsRouter.post('/precheck', async (req, res, next) => {
  try {
    const parsed = precheckSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, { code: 'BAD_REQUEST', message: 'Invalid body', details: parsed.error.flatten() });
    }

    const { user, amount, currency, recipient, nonceSec, signature } = parsed.data;

    const message = buildPrecheckMessage(user, nonceSec);
    const signatureOk = await verifyUserSignature({ expectedAddress: user, message, signature });
    if (!signatureOk) {
      throw new AppError(400, { code: 'BAD_REQUEST', message: 'Invalid signature' });
    }

    const amountInt = ensureBigInt(amount, 'amount');
    const result = await precheck(user, amountInt, recipient);

    const issues: Array<{ asset: string; need: string; have: string }> = [];

    if (result.usdcBalance < amountInt) {
      issues.push({ asset: currency, need: amount, have: result.usdcBalance.toString() });
    }

    const gasPriceCandidate = result.feeData.maxFeePerGas ?? result.feeData.gasPrice;
    if (gasPriceCandidate) {
      try {
        const price = BigInt(gasPriceCandidate);
        const required = result.gasEstimate * price;
        if (result.hypeBalance < required) {
          issues.push({ asset: 'HYPE', need: required.toString(), have: result.hypeBalance.toString() });
        }
      } catch {
        // ignore parse errors for gas price
      }
    }

    if (issues.length) {
      throw new AppError(400, {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds',
        details: { items: issues },
      });
    }

    return res.json({
      ok: true,
      needsApproval: result.needsApproval,
      estimatedGasUnits: result.gasEstimate.toString(),
      feeData: result.feeData,
      feeBps: config.router.feeBps,
      decimals: result.decimals,
      balances: {
        hype: result.hypeBalance.toString(),
        usdc: result.usdcBalance.toString(),
      },
      allowance: result.allowance.toString(),
    });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post('/intents', async (req, res, next) => {
  try {
    const parsed = intentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, { code: 'BAD_REQUEST', message: 'Invalid body', details: parsed.error.flatten() });
    }

    const { user, amount, currency, recipient, nonceSec, signature } = parsed.data;
    const message = buildIntentsMessage(user, recipient, amount, currency, nonceSec);
    const signatureOk = await verifyUserSignature({ expectedAddress: user, message, signature });
    if (!signatureOk) {
      throw new AppError(400, { code: 'BAD_REQUEST', message: 'Invalid signature' });
    }

    const amountInt = ensureBigInt(amount, 'amount');
    const headerKey = (req.header('Idempotency-Key') ?? '').trim();
    const intentId = headerKey
      ? headerKey
      : buildIntentId(user, recipient, amountInt, currency);

    const existing = find(intentId);
    if (existing) {
      return res.json({
        intentId,
        router: config.router.payment,
        token: config.tokens.usdc,
        platformFeeBps: config.router.feeBps,
        decimals: 6,
        createdAt: existing.createdAt,
        status: existing.status,
        txHash: existing.txHash ?? null,
      });
    }

    const createdAt = Math.floor(Date.now() / 1000);
    save({
      intentId,
      user: utils.getAddress(user),
      recipient: utils.getAddress(recipient),
      amount,
      status: 'CREATED',
      createdAt,
    });

    return res.json({
      intentId,
      router: config.router.payment,
      token: config.tokens.usdc,
      platformFeeBps: config.router.feeBps,
      decimals: 6,
      createdAt,
      status: 'CREATED',
      txHash: null,
    });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.post('/:intentId/confirm', async (req, res, next) => {
  try {
    const { intentId } = req.params;
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, { code: 'BAD_REQUEST', message: 'Invalid body', details: parsed.error.flatten() });
    }

    const intent = find(intentId);
    if (!intent) {
      throw new AppError(400, { code: 'BAD_REQUEST', message: 'Unknown intentId' });
    }

    const { txHash } = parsed.data;
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new AppError(503, { code: 'UPSTREAM_UNAVAILABLE', message: 'Receipt not found yet' });
    }

    if (receipt.status === 0) {
      const reason = await tryGetRevertReason(txHash);
      throw new AppError(400, { code: 'ONCHAIN_REVERT', message: reason ?? 'Transaction reverted' });
    }

    update(intentId, { status: 'SUCCESS', txHash });

    return res.json({
      status: 'SUCCESS',
      intentId,
      tx: {
        hash: txHash,
        blockNumber: receipt.blockNumber,
      },
      amount: intent.amount,
      recipient: intent.recipient,
      feeBps: config.router.feeBps,
    });
  } catch (error) {
    next(error);
  }
});

export { paymentsRouter };
