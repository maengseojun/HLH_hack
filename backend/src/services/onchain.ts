import { Contract, providers, utils } from 'ethers';
import { config } from '../config.js';
import { ERC20_ABI } from '../abi/erc20.js';
import { PAYMENT_ROUTER_ABI } from '../abi/paymentRouter.js';

export const provider = new providers.JsonRpcProvider(config.chain.rpcUrl, config.chain.chainId);

export function erc20(address: string): Contract {
  return new Contract(utils.getAddress(address), ERC20_ABI, provider);
}

export function paymentRouter(address: string): Contract {
  return new Contract(utils.getAddress(address), PAYMENT_ROUTER_ABI, provider);
}

export const routerInterface = new utils.Interface(PAYMENT_ROUTER_ABI as any);

export function buildIntentId(
  user: string,
  recipient: string,
  amount: bigint,
  currency: string,
): string {
  const packed = utils.solidityPack(
    ['address', 'address', 'uint256', 'string', 'uint256'],
    [utils.getAddress(user), utils.getAddress(recipient), amount, currency, config.chain.chainId],
  );
  return utils.keccak256(packed);
}

export async function getNativeBalance(address: string): Promise<bigint> {
  const balance = await provider.getBalance(utils.getAddress(address));
  return balance.toBigInt();
}
