import { BigNumber, ethers } from 'ethers';
import { config } from '../config.js';
import { erc20, getNativeBalance, provider, routerInterface } from './onchain.js';
import { ERC20_ABI } from '../abi/erc20.js';
import { getCached, setCached } from './gasCache.js';

const { utils } = ethers;
const erc20Interface = new utils.Interface(ERC20_ABI as any);
const ZERO_INTENT = `0x${'00'.repeat(32)}`;

type PrecheckResult = {
  decimals: number;
  hypeBalance: bigint;
  usdcBalance: bigint;
  needsApproval: boolean;
  gasEstimate: bigint;
  feeData: {
    gasPrice: string | null;
    maxFeePerGas: string | null;
    maxPriorityFeePerGas: string | null;
  };
  allowance: bigint;
};

export async function precheck(user: string, amountInt: bigint, merchant: string): Promise<PrecheckResult> {
  const normalizedUser = utils.getAddress(user);
  const normalizedMerchant = utils.getAddress(merchant);
  const token = erc20(config.tokens.usdc);

  const [decimals, nativeBalance, usdcBalanceBN, allowanceBN] = await Promise.all([
    token.decimals() as Promise<number>,
    getNativeBalance(normalizedUser),
    token.balanceOf(normalizedUser).then((value: BigNumber) => value.toBigInt()),
    token.allowance(normalizedUser, config.router.payment).then((value: BigNumber) => value.toBigInt()),
  ]);

  const needsApproval = allowanceBN < amountInt;
  const cacheKey = `gas:${normalizedUser}:${amountInt}:${normalizedMerchant}:${needsApproval}`;
  let gasUnits = getCached<bigint>(cacheKey);

  if (gasUnits == null) {
    let total = 0n;

    try {
      const data = routerInterface.encodeFunctionData('settle', [amountInt, normalizedMerchant, ZERO_INTENT]);
      const estimate = await provider.estimateGas({
        from: normalizedUser,
        to: config.router.payment,
        data,
      });
      total += estimate.toBigInt();
    } catch (error) {
      // swallow estimation failures; client can still proceed with default buffer
    }

    if (needsApproval) {
      try {
        const data = erc20Interface.encodeFunctionData('approve', [config.router.payment, amountInt]);
        const estimate = await provider.estimateGas({
          from: normalizedUser,
          to: config.tokens.usdc,
          data,
        });
        total += estimate.toBigInt();
      } catch (error) {
        // ignore estimation errors, caller will fall back to manual gas limit
      }
    }

    gasUnits = total;
    setCached(cacheKey, total);
  }

  const feeData = await provider.getFeeData();

  return {
    decimals,
    hypeBalance: nativeBalance,
    usdcBalance: usdcBalanceBN,
    needsApproval,
    gasEstimate: gasUnits,
    allowance: allowanceBN,
    feeData: {
      gasPrice: feeData.gasPrice ? feeData.gasPrice.toString() : null,
      maxFeePerGas: feeData.maxFeePerGas ? feeData.maxFeePerGas.toString() : null,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? feeData.maxPriorityFeePerGas.toString() : null,
    },
  };
}
