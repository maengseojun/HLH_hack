// lib/trading/hybrid-blockchain-router.ts
/**
 * 🚀 Hybrid Blockchain Router
 * 
 * Combines:
 * - Off-chain orderbook (fast matching)
 * - On-chain AMM (liquidity)
 * - On-chain settlement (security)
 * 
 * Flow:
 * 1. Orders routed to best execution venue
 * 2. Off-chain matches settled on-chain
 * 3. AMM trades execute directly on-chain
 */

import { SmartRouterV2 } from './smart-router-v2';
import { HyperVMAMM } from '@/lib/blockchain/hypervm-amm';
import { getSettlementService, OnChainSettlementService } from './on-chain-settlement';
import { createClient } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';

interface BlockchainConfig {
  rpcUrl: string;
  contracts: {
    router: string;
    factory: string;
    hyperIndex: string;
    usdc: string;
    pair: string;
    settlement: string;
  };
  settlementOperatorKey: string; // Private key for settlement operator
}

interface HybridOrderParams {
  userId: string;
  userAddress: string;
  pair: string;
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  amount: string;
  price?: string;
  slippageTolerance?: number;
}

interface HybridExecutionResult {
  success: boolean;
  orderId?: string;
  executions: Array<{
    source: 'AMM' | 'Orderbook';
    amount: string;
    price: string;
    txHash?: string;
    tradeId?: string;
  }>;
  totalExecuted: string;
  averagePrice: string;
  settlementStatus?: 'immediate' | 'pending' | 'confirmed';
}

export class HybridBlockchainRouter {
  private smartRouter: SmartRouterV2;
  private amm: HyperVMAMM;
  private settlementService: OnChainSettlementService;
  private config: BlockchainConfig;
  private supabase;

  constructor(config: BlockchainConfig) {
    this.config = config;
    this.supabase = createClient();
    
    // Initialize components
    this.smartRouter = new SmartRouterV2();
    this.amm = new HyperVMAMM(config.rpcUrl, config.contracts);
    
    // Initialize settlement service
    this.settlementService = getSettlementService({
      contractAddress: config.contracts.settlement,
      providerUrl: config.rpcUrl,
      privateKey: config.settlementOperatorKey,
      tokenAddresses: {
        HYPERINDEX: config.contracts.hyperIndex,
        USDC: config.contracts.usdc
      }
    });
  }

  /**
   * 🎯 Execute hybrid order with blockchain integration
   */
  async executeHybridOrder(params: HybridOrderParams): Promise<HybridExecutionResult> {
    console.log('🚀 Executing hybrid blockchain order:', params);

    const result: HybridExecutionResult = {
      success: false,
      executions: [],
      totalExecuted: '0',
      averagePrice: '0'
    };

    try {
      // Connect user's signer to AMM
      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        this.amm.connectSigner(signer);
      }

      // Get current market conditions
      const marketData = await this.getMarketData(params.pair);
      
      // Determine optimal routing strategy
      const routingStrategy = await this.determineRoutingStrategy(
        params,
        marketData
      );

      // Execute based on strategy
      if (routingStrategy.useAMM && routingStrategy.useOrderbook) {
        // Hybrid execution - split between venues
        result.orderId = await this.executeHybridSplit(params, routingStrategy, result);
      } else if (routingStrategy.useAMM) {
        // Pure AMM execution
        await this.executeAMMOnly(params, result);
      } else if (routingStrategy.useOrderbook) {
        // Pure orderbook execution
        result.orderId = await this.executeOrderbookOnly(params, result);
      }

      // Calculate final results
      if (result.executions.length > 0) {
        result.success = true;
        result.totalExecuted = this.sumExecutions(result.executions);
        result.averagePrice = this.calculateAveragePrice(result.executions);
      }

      // Record in database
      await this.recordHybridExecution(params, result);

    } catch (error) {
      console.error('❌ Hybrid execution failed:', error);
      result.success = false;
    }

    return result;
  }

  /**
   * 🔀 Execute split order across AMM and orderbook
   */
  private async executeHybridSplit(
    params: HybridOrderParams,
    strategy: any,
    result: HybridExecutionResult
  ): Promise<string> {
    console.log('🔀 Executing hybrid split order');

    // 1. Execute AMM portion
    if (strategy.ammAmount > 0) {
      await this.executeAMMPortion(
        params,
        strategy.ammAmount.toString(),
        result
      );
    }

    // 2. Execute orderbook portion
    let orderId = '';
    if (strategy.orderbookAmount > 0) {
      orderId = await this.executeOrderbookPortion(
        params,
        strategy.orderbookAmount.toString(),
        result
      );
    }

    return orderId;
  }

  /**
   * 💱 Execute AMM-only order
   */
  private async executeAMMOnly(
    params: HybridOrderParams,
    result: HybridExecutionResult
  ): Promise<void> {
    console.log('💱 Executing AMM-only order');

    const tokenIn = params.side === 'buy' 
      ? this.config.contracts.usdc 
      : this.config.contracts.hyperIndex;
    const tokenOut = params.side === 'buy'
      ? this.config.contracts.hyperIndex
      : this.config.contracts.usdc;

    // Convert amount to proper decimals
    const decimals = params.side === 'buy' ? 6 : 18; // USDC: 6, HYPERINDEX: 18
    const amountIn = ethers.parseUnits(params.amount, decimals);

    // Execute swap on-chain
    const swapResult = await this.amm.executeSwap({
      tokenIn,
      tokenOut,
      amountIn: amountIn.toString(),
      slippageTolerance: params.slippageTolerance || 300, // 3%
      recipient: params.userAddress
    });

    // Record execution
    result.executions.push({
      source: 'AMM',
      amount: ethers.formatUnits(swapResult.amountOut, params.side === 'buy' ? 18 : 6),
      price: swapResult.effectivePrice,
      txHash: swapResult.hash
    });

    result.settlementStatus = 'immediate'; // AMM trades settle immediately
  }

  /**
   * 📖 Execute orderbook-only order
   */
  private async executeOrderbookOnly(
    params: HybridOrderParams,
    result: HybridExecutionResult
  ): Promise<string> {
    console.log('📖 Executing orderbook-only order');

    // Create order via smart router
    const orderResult = await this.smartRouter.routeOrder({
      ...params,
      userId: params.userId,
      userAddress: params.userAddress
    });

    // Extract execution details
    for (const chunk of orderResult.executedChunks) {
      if (chunk.source === 'Orderbook' && chunk.trades) {
        for (const trade of chunk.trades) {
          result.executions.push({
            source: 'Orderbook',
            amount: trade.amount,
            price: trade.price,
            tradeId: trade.id
          });

          // Queue for on-chain settlement
          await this.settlementService.queueTradeForSettlement({
            redisTradeId: trade.id,
            buyer: trade.buyer,
            seller: trade.seller,
            pair: params.pair,
            price: trade.price,
            amount: trade.amount,
            source: 'Orderbook'
          });
        }
      }
    }

    result.settlementStatus = 'pending'; // Orderbook trades need settlement
    return orderResult.orderId || '';
  }

  /**
   * 💰 Execute AMM portion of split order
   */
  private async executeAMMPortion(
    params: HybridOrderParams,
    amount: string,
    result: HybridExecutionResult
  ): Promise<void> {
    const ammParams = { ...params, amount };
    await this.executeAMMOnly(ammParams, result);
  }

  /**
   * 📊 Execute orderbook portion of split order
   */
  private async executeOrderbookPortion(
    params: HybridOrderParams,
    amount: string,
    result: HybridExecutionResult
  ): Promise<string> {
    const orderbookParams = { ...params, amount };
    return this.executeOrderbookOnly(orderbookParams, result);
  }

  /**
   * 📈 Get current market data from both venues
   */
  private async getMarketData(pair: string): Promise<{
    ammPrice: number;
    ammLiquidity: number;
    orderbookBestBid: number;
    orderbookBestAsk: number;
    orderbookDepth: number;
  }> {
    // Get AMM data
    const ammReserves = await this.amm.getPairReserves();
    const ammPrice = parseFloat(ammReserves.reserve1) / parseFloat(ammReserves.reserve0);
    const ammLiquidity = Math.sqrt(
      parseFloat(ammReserves.reserve0) * parseFloat(ammReserves.reserve1)
    );

    // Get orderbook data
    const orderbook = await this.smartRouter['getOrderbook'](pair);
    const orderbookBestBid = orderbook.bids[0]?.price || 0;
    const orderbookBestAsk = orderbook.asks[0]?.price || 0;
    const orderbookDepth = orderbook.bids.length + orderbook.asks.length;

    return {
      ammPrice,
      ammLiquidity,
      orderbookBestBid,
      orderbookBestAsk,
      orderbookDepth
    };
  }

  /**
   * 🎯 Determine optimal routing strategy
   */
  private async determineRoutingStrategy(
    params: HybridOrderParams,
    marketData: any
  ): Promise<{
    useAMM: boolean;
    useOrderbook: boolean;
    ammAmount: number;
    orderbookAmount: number;
  }> {
    const totalAmount = parseFloat(params.amount);
    
    // For market orders, check price impact
    if (params.type === 'market') {
      // Calculate AMM price impact
      const ammQuote = await this.amm.getSwapQuote(
        params.side === 'buy' ? this.config.contracts.usdc : this.config.contracts.hyperIndex,
        params.side === 'buy' ? this.config.contracts.hyperIndex : this.config.contracts.usdc,
        ethers.parseUnits(params.amount, params.side === 'buy' ? 6 : 18).toString()
      );

      // If price impact > 1%, split order
      if (ammQuote.priceImpact > 1) {
        const ammPortion = 0.5; // Split 50/50
        return {
          useAMM: true,
          useOrderbook: true,
          ammAmount: totalAmount * ammPortion,
          orderbookAmount: totalAmount * (1 - ammPortion)
        };
      }
    }

    // For limit orders, check if price is achievable
    if (params.type === 'limit' && params.price) {
      const limitPrice = parseFloat(params.price);
      const canFillOnOrderbook = params.side === 'buy' 
        ? limitPrice >= marketData.orderbookBestAsk
        : limitPrice <= marketData.orderbookBestBid;

      if (canFillOnOrderbook && marketData.orderbookDepth > 10) {
        // Good orderbook liquidity, use it
        return {
          useAMM: false,
          useOrderbook: true,
          ammAmount: 0,
          orderbookAmount: totalAmount
        };
      }
    }

    // Default: Use AMM for better UX (immediate execution)
    return {
      useAMM: true,
      useOrderbook: false,
      ammAmount: totalAmount,
      orderbookAmount: 0
    };
  }

  /**
   * 💾 Record hybrid execution in database
   */
  private async recordHybridExecution(
    params: HybridOrderParams,
    result: HybridExecutionResult
  ): Promise<void> {
    // Record each execution as a trade
    for (const execution of result.executions) {
      const tradeData = {
        id: uuidv4(),
        pair: params.pair,
        buyer_order_id: execution.source === 'AMM' ? 'amm' : params.userAddress,
        seller_order_id: execution.source === 'AMM' ? 'amm' : 'orderbook',
        price: execution.price,
        amount: execution.amount,
        side: params.side,
        source: execution.source,
        user_id: params.userId,
        settlement_tx_hash: execution.txHash || null,
        settlement_status: execution.source === 'AMM' ? 'confirmed' : 'pending',
        settled_at: execution.source === 'AMM' ? new Date().toISOString() : null,
        redis_trade_id: execution.tradeId || `hybrid-${Date.now()}`,
        executed_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from('trade_history')
        .insert(tradeData);

      if (error) {
        console.error('❌ Failed to record trade:', error);
      }
    }
  }

  /**
   * Helper functions
   */
  private sumExecutions(executions: any[]): string {
    const total = executions.reduce(
      (sum, exec) => sum + parseFloat(exec.amount),
      0
    );
    return total.toString();
  }

  private calculateAveragePrice(executions: any[]): string {
    if (executions.length === 0) return '0';
    
    let totalValue = 0;
    let totalAmount = 0;
    
    for (const exec of executions) {
      const amount = parseFloat(exec.amount);
      const price = parseFloat(exec.price);
      totalValue += amount * price;
      totalAmount += amount;
    }
    
    return totalAmount > 0 ? (totalValue / totalAmount).toString() : '0';
  }

  /**
   * 📊 Get settlement status for trades
   */
  async getSettlementStatus(): Promise<any> {
    return this.settlementService.getSettlementStats();
  }
}