// backend/src/services/coreWriter.ts
import { ethers } from 'ethers';
import { config } from '../config.js';

// CoreWriter ABI
const CORE_WRITER_ABI = [
  {
    name: 'sendRawAction',
    type: 'function',
    inputs: [{ name: 'data', type: 'bytes' }],
    outputs: [],
    stateMutability: 'nonpayable'
  }
];

// Precompile addresses
export const PRECOMPILE_ADDRESSES = {
  POSITIONS: '0x0000000000000000000000000000000000000800',
  SPOT_BALANCE: '0x0000000000000000000000000000000000000801',
  VAULT_EQUITY: '0x0000000000000000000000000000000000000802',
  STAKING_DELEGATIONS: '0x0000000000000000000000000000000000000803',
  ORACLE_PRICES: '0x0000000000000000000000000000000000000804',
  L1_BLOCK_NUMBER: '0x0000000000000000000000000000000000000805',
  PERP_ORACLE_PRICE: '0x0000000000000000000000000000000000000807',
  SPOT_PRICE: '0x0000000000000000000000000000000000000808'
};

// Action IDs
export const ACTION_IDS = {
  LIMIT_ORDER: 1,
  VAULT_TRANSFER: 2,
  TOKEN_DELEGATE: 3,
  STAKING_DEPOSIT: 4,
  STAKING_WITHDRAW: 5,
  SPOT_SEND: 6,
  USD_CLASS_TRANSFER: 7,
  FINALIZE_EVM_CONTRACT: 8,
  ADD_API_WALLET: 9,
  CANCEL_ORDER_BY_OID: 10,
  CANCEL_ORDER_BY_CLOID: 11
};

// TIF encodings
export const TIF = {
  ALO: 1,
  GTC: 2,
  IOC: 3
};

export interface LimitOrderParams {
  asset: number;
  isBuy: boolean;
  limitPx: ethers.BigNumber;  // 10^8 * human readable value
  sz: ethers.BigNumber;       // 10^8 * human readable value
  reduceOnly: boolean;
  tif: number;      // 1=ALO, 2=GTC, 3=IOC
  cloid: ethers.BigNumber;    // 0 = no cloid
}

export interface UsdClassTransferParams {
  ntl: ethers.BigNumber;
  toPerp: boolean;
}

export interface VaultTransferParams {
  vault: string;
  isDeposit: boolean;
  usd: ethers.BigNumber;
}

export interface Position {
  szi: ethers.BigNumber;
  leverage: number;
  entryNtl: ethers.BigNumber;
}

export class CoreWriterService {
  private provider: ethers.providers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private coreWriter: ethers.Contract;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(config.hypercore.rpcUrl);
    this.wallet = new ethers.Wallet(config.hypercore.walletPrivateKey, this.provider);
    this.coreWriter = new ethers.Contract(
      '0x3333333333333333333333333333333333333333',
      CORE_WRITER_ABI,
      this.wallet
    );
  }

  /**
   * Build action data with proper encoding
   */
  private buildActionData(actionId: number, encodedAction: string): string {
    const encodedActionBytes = ethers.utils.arrayify(encodedAction);
    const data = new Uint8Array(4 + encodedActionBytes.length);
    
    data[0] = 1; // encoding version
    data[1] = 0;
    data[2] = 0;
    data[3] = actionId;
    
    data.set(encodedActionBytes, 4);
    
    return ethers.utils.hexlify(data);
  }

  /**
   * Place a limit order
   */
  async placeLimitOrder(params: LimitOrderParams): Promise<string> {
    const encodedAction = ethers.utils.defaultAbiCoder.encode(
      ['uint32', 'bool', 'uint64', 'uint64', 'bool', 'uint8', 'uint128'],
      [params.asset, params.isBuy, params.limitPx, params.sz, params.reduceOnly, params.tif, params.cloid]
    );

    const data = this.buildActionData(ACTION_IDS.LIMIT_ORDER, encodedAction);
    const tx = await this.coreWriter.sendRawAction(data);
    return tx.hash;
  }

  /**
   * Transfer USD between perp and spot
   */
  async usdClassTransfer(params: UsdClassTransferParams): Promise<string> {
    const encodedAction = ethers.utils.defaultAbiCoder.encode(
      ['uint64', 'bool'],
      [params.ntl, params.toPerp]
    );

    const data = this.buildActionData(ACTION_IDS.USD_CLASS_TRANSFER, encodedAction);
    const tx = await this.coreWriter.sendRawAction(data);
    return tx.hash;
  }

  /**
   * Vault deposit/withdraw
   */
  async vaultTransfer(params: VaultTransferParams): Promise<string> {
    const encodedAction = ethers.utils.defaultAbiCoder.encode(
      ['address', 'bool', 'uint64'],
      [params.vault, params.isDeposit, params.usd]
    );

    const data = this.buildActionData(ACTION_IDS.VAULT_TRANSFER, encodedAction);
    const tx = await this.coreWriter.sendRawAction(data);
    return tx.hash;
  }

  /**
   * Cancel order by order ID
   */
  async cancelOrderByOid(asset: number, oid: ethers.BigNumber): Promise<string> {
    const encodedAction = ethers.utils.defaultAbiCoder.encode(
      ['uint32', 'uint64'],
      [asset, oid]
    );

    const data = this.buildActionData(ACTION_IDS.CANCEL_ORDER_BY_OID, encodedAction);
    const tx = await this.coreWriter.sendRawAction(data);
    return tx.hash;
  }

  /**
   * Cancel order by client order ID
   */
  async cancelOrderByCloid(asset: number, cloid: ethers.BigNumber): Promise<string> {
    const encodedAction = ethers.utils.defaultAbiCoder.encode(
      ['uint32', 'uint128'],
      [asset, cloid]
    );

    const data = this.buildActionData(ACTION_IDS.CANCEL_ORDER_BY_CLOID, encodedAction);
    const tx = await this.coreWriter.sendRawAction(data);
    return tx.hash;
  }

  // Read functions using precompiles
  /**
   * Read perp position for a user and asset
   */
  async readPerpPosition(user: string, asset: number): Promise<Position> {
    const encodedInput = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint32'],
      [user, asset]
    );

    const result = await this.provider.call({
      to: PRECOMPILE_ADDRESSES.POSITIONS,
      data: encodedInput
    });

    const decoded = ethers.utils.defaultAbiCoder.decode(
      ['int64', 'uint32', 'uint64'],
      result
    );

    return {
      szi: decoded[0],
      leverage: Number(decoded[1]),
      entryNtl: decoded[2]
    };
  }

  /**
   * Read spot balance for a user and token
   */
  async readSpotBalance(user: string, token: number): Promise<ethers.BigNumber> {
    const encodedInput = ethers.utils.defaultAbiCoder.encode(
      ['address', 'uint32'],
      [user, token]
    );

    const result = await this.provider.call({
      to: PRECOMPILE_ADDRESSES.SPOT_BALANCE,
      data: encodedInput
    });

    return ethers.utils.defaultAbiCoder.decode(['uint64'], result)[0];
  }

  /**
   * Read vault equity
   */
  async readVaultEquity(vault: string): Promise<ethers.BigNumber> {
    const encodedInput = ethers.utils.defaultAbiCoder.encode(
      ['address'],
      [vault]
    );

    const result = await this.provider.call({
      to: PRECOMPILE_ADDRESSES.VAULT_EQUITY,
      data: encodedInput
    });

    return ethers.utils.defaultAbiCoder.decode(['uint64'], result)[0];
  }

  /**
   * Read perp oracle price
   */
  async readPerpOraclePrice(asset: number): Promise<ethers.BigNumber> {
    const encodedInput = ethers.utils.defaultAbiCoder.encode(
      ['uint32'],
      [asset]
    );

    const result = await this.provider.call({
      to: PRECOMPILE_ADDRESSES.PERP_ORACLE_PRICE,
      data: encodedInput
    });

    return ethers.utils.defaultAbiCoder.decode(['uint64'], result)[0];
  }

  /**
   * Read spot price
   */
  async readSpotPrice(token: number): Promise<ethers.BigNumber> {
    const encodedInput = ethers.utils.defaultAbiCoder.encode(
      ['uint32'],
      [token]
    );

    const result = await this.provider.call({
      to: PRECOMPILE_ADDRESSES.SPOT_PRICE,
      data: encodedInput
    });

    return ethers.utils.defaultAbiCoder.decode(['uint64'], result)[0];
  }

  /**
   * Read L1 block number
   */
  async readL1BlockNumber(): Promise<ethers.BigNumber> {
    const result = await this.provider.call({
      to: PRECOMPILE_ADDRESSES.L1_BLOCK_NUMBER,
      data: '0x'
    });

    return ethers.utils.defaultAbiCoder.decode(['uint64'], result)[0];
  }

  /**
   * Helper functions for price conversion
   */
  convertPerpPrice(price: ethers.BigNumber, szDecimals: number): number {
    const divisor = ethers.BigNumber.from(10).pow(6 - szDecimals);
    return price.div(divisor).toNumber();
  }

  convertSpotPrice(price: ethers.BigNumber, baseAssetDecimals: number): number {
    const divisor = ethers.BigNumber.from(10).pow(8 - baseAssetDecimals);
    return price.div(divisor).toNumber();
  }
}

export const coreWriterService = new CoreWriterService();
