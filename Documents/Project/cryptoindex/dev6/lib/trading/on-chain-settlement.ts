// lib/trading/on-chain-settlement.ts
/**
 * 🔗 On-chain Settlement Service
 * 
 * Bridges off-chain orderbook trades to on-chain settlement
 * Ensures atomic execution of matched trades on blockchain
 */

import { ethers } from 'ethers';
import { createClient } from '@/lib/supabase/client';
import { redisClient } from '@/lib/redis/client';

// Settlement Contract ABI (minimal)
const SETTLEMENT_ABI = [
  "function settleTrade(bytes32 tradeId, address buyer, address seller, address tokenBuy, address tokenSell, uint256 amountBuy, uint256 amountSell, uint256 buyerNonce, uint256 sellerNonce) external",
  "function batchSettleTrades(bytes32[] tradeIds, address[] buyers, address[] sellers, address[] tokensBuy, address[] tokensSell, uint256[] amountsBuy, uint256[] amountsSell, uint256[] buyerNonces, uint256[] sellerNonces) external",
  "function getUserNonce(address user) view returns (uint256)",
  "function calculateFee(uint256 amount) view returns (uint256)",
  "event TradeSettled(bytes32 indexed tradeId, address indexed buyer, address indexed seller, address tokenBuy, address tokenSell, uint256 amountBuy, uint256 amountSell, uint256 buyerFee, uint256 sellerFee, uint256 timestamp)"
];

// ERC20 ABI for approvals
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

interface SettlementConfig {
  contractAddress: string;
  providerUrl: string;
  privateKey: string; // Settlement operator private key
  tokenAddresses: {
    HYPERINDEX: string;
    USDC: string;
  };
}

interface PendingTrade {
  tradeId: string;
  buyer: string;
  seller: string;
  buyToken: string;
  sellToken: string;
  buyAmount: string;
  sellAmount: string;
  redisTradeId: string;
  timestamp: Date;
}

export class OnChainSettlementService {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private settlementContract: ethers.Contract;
  private config: SettlementConfig;
  private isProcessing: boolean = false;
  private batchSize: number = 10; // Max trades per batch
  private settlementQueue: PendingTrade[] = [];

  constructor(config: SettlementConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.providerUrl);
    this.signer = new ethers.Wallet(config.privateKey, this.provider);
    this.settlementContract = new ethers.Contract(
      config.contractAddress,
      SETTLEMENT_ABI,
      this.signer
    );
    
    // Start settlement processor
    this.startSettlementProcessor();
  }

  /**
   * 🔄 Queue a trade for on-chain settlement
   */
  async queueTradeForSettlement(trade: {
    redisTradeId: string;
    buyer: { address: string; orderId: string };
    seller: { address: string; orderId: string };
    pair: string;
    price: string;
    amount: string;
    source: 'Orderbook' | 'AMM';
  }): Promise<void> {
    // Only settle orderbook trades (AMM trades are already on-chain)
    if (trade.source !== 'Orderbook') {
      return;
    }

    const [buyToken, sellToken] = this.parseTokenPair(trade.pair);
    
    const pendingTrade: PendingTrade = {
      tradeId: ethers.id(trade.redisTradeId), // Convert to bytes32
      buyer: trade.buyer.address,
      seller: trade.seller.address,
      buyToken: this.getTokenAddress(buyToken),
      sellToken: this.getTokenAddress(sellToken),
      buyAmount: ethers.parseUnits(trade.amount, this.getTokenDecimals(buyToken)).toString(),
      sellAmount: ethers.parseUnits(
        (parseFloat(trade.amount) * parseFloat(trade.price)).toString(),
        this.getTokenDecimals(sellToken)
      ).toString(),
      redisTradeId: trade.redisTradeId,
      timestamp: new Date()
    };

    this.settlementQueue.push(pendingTrade);
    console.log(`📝 Trade ${trade.redisTradeId} queued for settlement`);

    // Process immediately if not already processing
    if (!this.isProcessing) {
      await this.processSettlementQueue();
    }
  }

  /**
   * 🔧 Process settlement queue
   */
  private async processSettlementQueue(): Promise<void> {
    if (this.isProcessing || this.settlementQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.settlementQueue.length > 0) {
        // Take a batch of trades
        const batch = this.settlementQueue.splice(0, this.batchSize);
        
        if (batch.length === 1) {
          // Single trade settlement
          await this.settleSingleTrade(batch[0]);
        } else {
          // Batch settlement for gas optimization
          await this.settleBatchTrades(batch);
        }
      }
    } catch (_error) {
      console.error('❌ Settlement processing error:', _error);
      // Re-queue failed trades
      // In production, implement proper retry logic
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 💸 Settle a single trade on-chain
   */
  private async settleSingleTrade(trade: PendingTrade): Promise<void> {
    try {
      console.log(`⏳ Settling trade ${trade.redisTradeId} on-chain...`);

      // Get current nonces
      const buyerNonce = await this.settlementContract.getUserNonce(trade.buyer);
      const sellerNonce = await this.settlementContract.getUserNonce(trade.seller);

      // Ensure token approvals
      await this.ensureApprovals(trade);

      // Execute settlement
      const tx = await this.settlementContract.settleTrade(
        trade.tradeId,
        trade.buyer,
        trade.seller,
        trade.buyToken,
        trade.sellToken,
        trade.buyAmount,
        trade.sellAmount,
        buyerNonce,
        sellerNonce
      );

      console.log(`📝 Settlement tx submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Trade settled on-chain: ${receipt.hash}`);

      // Update database with on-chain settlement info
      await this.updateTradeWithSettlement(trade.redisTradeId, receipt.hash);

    } catch (_error) {
      console.error(`❌ Failed to settle trade ${trade.redisTradeId}:`, _error);
      throw _error;
    }
  }

  /**
   * 📦 Settle multiple trades in batch
   */
  private async settleBatchTrades(trades: PendingTrade[]): Promise<void> {
    try {
      console.log(`⏳ Settling ${trades.length} trades in batch...`);

      // Prepare batch arrays
      const tradeIds = trades.map(t => t.tradeId);
      const buyers = trades.map(t => t.buyer);
      const sellers = trades.map(t => t.seller);
      const tokensBuy = trades.map(t => t.buyToken);
      const tokensSell = trades.map(t => t.sellToken);
      const amountsBuy = trades.map(t => t.buyAmount);
      const amountsSell = trades.map(t => t.sellAmount);
      
      // Get nonces for all participants
      const buyerNonces = await Promise.all(
        buyers.map(buyer => this.settlementContract.getUserNonce(buyer))
      );
      const sellerNonces = await Promise.all(
        sellers.map(seller => this.settlementContract.getUserNonce(seller))
      );

      // Ensure all approvals
      for (const trade of trades) {
        await this.ensureApprovals(trade);
      }

      // Execute batch settlement
      const tx = await this.settlementContract.batchSettleTrades(
        tradeIds,
        buyers,
        sellers,
        tokensBuy,
        tokensSell,
        amountsBuy,
        amountsSell,
        buyerNonces,
        sellerNonces
      );

      console.log(`📝 Batch settlement tx: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`✅ Batch settled on-chain: ${receipt.hash}`);

      // Update all trades with settlement info
      for (const trade of trades) {
        await this.updateTradeWithSettlement(trade.redisTradeId, receipt.hash);
      }

    } catch (_error) {
      console.error('❌ Failed to settle batch:', _error);
      throw _error;
    }
  }

  /**
   * 🔐 Ensure token approvals for settlement
   */
  private async ensureApprovals(trade: PendingTrade): Promise<void> {
    // In production, this would interact with user wallets
    // For now, assume approvals are already in place
    console.log('🔐 Checking token approvals...');
    
    // Check buyer approval for buyToken
    const buyTokenContract = new ethers.Contract(trade.buyToken, ERC20_ABI, this.provider);
    const buyerAllowance = await buyTokenContract.allowance(trade.buyer, this.config.contractAddress);
    
    if (buyerAllowance < BigInt(trade.buyAmount)) {
      console.log(`⚠️ Buyer needs to approve ${trade.buyAmount} of ${trade.buyToken}`);
      // In production: Request approval from user
    }

    // Check seller approval for sellToken
    const sellTokenContract = new ethers.Contract(trade.sellToken, ERC20_ABI, this.provider);
    const sellerAllowance = await sellTokenContract.allowance(trade.seller, this.config.contractAddress);
    
    if (sellerAllowance < BigInt(trade.sellAmount)) {
      console.log(`⚠️ Seller needs to approve ${trade.sellAmount} of ${trade.sellToken}`);
      // In production: Request approval from user
    }
  }

  /**
   * 📊 Update trade history with settlement info
   */
  private async updateTradeWithSettlement(redisTradeId: string, txHash: string): Promise<void> {
    const supabase = createClient();
    
    // Add settlement transaction hash to trade_history
    const { error } = await supabase
      .from('trade_history')
      .update({ 
        settlement_tx_hash: txHash,
        settled_at: new Date().toISOString()
      })
      .eq('redis_trade_id', redisTradeId);

    if (error) {
      console.error('❌ Failed to update trade settlement info:', _error);
    }
  }

  /**
   * 🔄 Start periodic settlement processor
   */
  private startSettlementProcessor(): void {
    // Process queue every 5 seconds
    setInterval(async () => {
      if (this.settlementQueue.length > 0) {
        await this.processSettlementQueue();
      }
    }, 5000);
  }

  /**
   * Helper functions
   */
  private parseTokenPair(pair: string): [string, string] {
    const tokens = pair.split('-');
    return [tokens[0], tokens[1]];
  }

  private getTokenAddress(symbol: string): string {
    if (symbol === 'HYPERINDEX') {
      return this.config.tokenAddresses.HYPERINDEX;
    } else if (symbol === 'USDC') {
      return this.config.tokenAddresses.USDC;
    }
    throw new Error(`Unknown token: ${symbol}`);
  }

  private getTokenDecimals(symbol: string): number {
    if (symbol === 'HYPERINDEX') {
      return 18;
    } else if (symbol === 'USDC') {
      return 6;
    }
    return 18;
  }

  /**
   * 📈 Monitor settlement status
   */
  async getSettlementStats(): Promise<{
    queueLength: number;
    isProcessing: boolean;
    lastSettlement?: Date;
  }> {
    return {
      queueLength: this.settlementQueue.length,
      isProcessing: this.isProcessing,
      lastSettlement: this.settlementQueue[0]?.timestamp
    };
  }
}

// Singleton instance
let settlementService: OnChainSettlementService | null = null;

export function getSettlementService(config?: SettlementConfig): OnChainSettlementService {
  if (!settlementService && config) {
    settlementService = new OnChainSettlementService(config);
  }
  if (!settlementService) {
    throw new Error('Settlement service not initialized');
  }
  return settlementService;
}