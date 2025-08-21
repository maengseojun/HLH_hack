'use client';

/**
 * 🚀 Blockchain Hybrid Trading Test Page
 * 
 * Real blockchain integration with:
 * - On-chain AMM swaps
 * - Off-chain orderbook matching
 * - On-chain settlement for orderbook trades
 * - Real-time execution tracking
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { usePrivy } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { HybridBlockchainRouter } from '@/lib/trading/hybrid-blockchain-router';

// Contract addresses (from deployment)
const BLOCKCHAIN_CONFIG = {
  rpcUrl: process.env.NEXT_PUBLIC_HYPERVM_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm',
  contracts: {
    router: process.env.NEXT_PUBLIC_AMM_ROUTER_ADDRESS || '',
    factory: process.env.NEXT_PUBLIC_AMM_FACTORY_ADDRESS || '',
    hyperIndex: process.env.NEXT_PUBLIC_HYPERINDEX_TOKEN_ADDRESS || '',
    usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '0xd9CBEC81df392A88AEff575E962d149d57F4d6bc',
    pair: process.env.NEXT_PUBLIC_HYPERINDEX_USDC_PAIR || '',
    settlement: process.env.NEXT_PUBLIC_SETTLEMENT_ADDRESS || ''
  },
  settlementOperatorKey: process.env.SETTLEMENT_OPERATOR_KEY || ''
};

interface ExecutionResult {
  success: boolean;
  orderId?: string;
  executions: Array<{
    source: 'AMM' | 'Orderbook';
    amount: string;
    price: string;
    txHash?: string;
  }>;
  totalExecuted: string;
  averagePrice: string;
  settlementStatus?: string;
}

export default function BlockchainHybridTestPage() {
  // const { ready, authenticated, user } = usePrivy();
  const ready = true, authenticated = false, user = null;
  const [hybridRouter, setHybridRouter] = useState<HybridBlockchainRouter | null>(null);
  
  // Order form state
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('100');
  const [price, setPrice] = useState('1.0');
  const [slippage, setSlippage] = useState('3');
  
  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<ExecutionResult | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionResult[]>([]);
  
  // Market data
  const [marketData, setMarketData] = useState({
    ammPrice: '0',
    orderbookBid: '0',
    orderbookAsk: '0',
    ammLiquidity: '0'
  });

  // Initialize hybrid router
  useEffect(() => {
    if (BLOCKCHAIN_CONFIG.contracts.router && authenticated) {
      try {
        const router = new HybridBlockchainRouter(BLOCKCHAIN_CONFIG);
        setHybridRouter(router);
        console.log('🔗 Hybrid blockchain router initialized');
      } catch (error) {
        console.error('❌ Failed to initialize router:', error);
      }
    }
  }, [authenticated]);

  // Update market data
  useEffect(() => {
    const interval = setInterval(async () => {
      await updateMarketData();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const updateMarketData = async () => {
    // In production, fetch real market data
    setMarketData({
      ammPrice: '1.02',
      orderbookBid: '1.01',
      orderbookAsk: '1.03',
      ammLiquidity: '1000000'
    });
  };

  const executeHybridOrder = async () => {
    if (!hybridRouter || !user?.wallet?.address) {
      alert('Please connect wallet first');
      return;
    }

    setIsExecuting(true);
    setLastResult(null);

    try {
      console.log('🚀 Executing hybrid order...');
      
      const result = await hybridRouter.executeHybridOrder({
        userId: user.id,
        userAddress: user.wallet.address,
        pair: 'HYPERINDEX-USDC',
        type: orderType,
        side: side,
        amount: amount,
        price: orderType === 'limit' ? price : undefined,
        slippageTolerance: parseInt(slippage) * 100 // Convert to basis points
      });

      console.log('✅ Order executed:', result);
      setLastResult(result);
      setExecutionHistory(prev => [result, ...prev].slice(0, 10));

    } catch (error) {
      console.error('❌ Execution failed:', error);
      alert('Order execution failed: ' + (error as Error).message);
    } finally {
      setIsExecuting(false);
    }
  };

  const getSettlementStatus = async () => {
    if (!hybridRouter) return;
    
    const stats = await hybridRouter.getSettlementStatus();
    console.log('📊 Settlement status:', stats);
  };

  if (!ready) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <h1 className="text-3xl font-bold mb-6">🚀 Blockchain Hybrid Trading Test</h1>
      
      {/* Status Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-4">
              <span className={`px-3 py-1 rounded-full text-sm ${
                authenticated ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {authenticated ? '✅ Wallet Connected' : '❌ Not Connected'}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm ${
                hybridRouter ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {hybridRouter ? '✅ Router Ready' : '⏳ Initializing...'}
              </span>
            </div>
            <Button onClick={getSettlementStatus} variant="outline" size="sm">
              📊 Settlement Status
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trading Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Hybrid Trading Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Order Type Tabs */}
            <Tabs value={orderType} onValueChange={(v) => setOrderType(v as 'market' | 'limit')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="market">Market Order</TabsTrigger>
                <TabsTrigger value="limit">Limit Order</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Side Selection */}
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant={side === 'buy' ? 'default' : 'outline'}
                onClick={() => setSide('buy')}
                className="w-full"
              >
                🟢 Buy
              </Button>
              <Button 
                variant={side === 'sell' ? 'default' : 'outline'}
                onClick={() => setSide('sell')}
                className="w-full"
              >
                🔴 Sell
              </Button>
            </div>

            {/* Amount Input */}
            <div>
              <Label>Amount ({side === 'buy' ? 'USDC' : 'HYPERINDEX'})</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Price Input (Limit Only) */}
            {orderType === 'limit' && (
              <div>
                <Label>Limit Price</Label>
                <Input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}

            {/* Slippage */}
            <div>
              <Label>Slippage Tolerance (%)</Label>
              <Input
                type="number"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                placeholder="3"
                min="0.1"
                max="50"
              />
            </div>

            {/* Execute Button */}
            <Button 
              onClick={executeHybridOrder}
              disabled={isExecuting || !hybridRouter}
              className="w-full"
              size="lg"
            >
              {isExecuting ? '⏳ Executing...' : '🚀 Execute Hybrid Order'}
            </Button>

            {/* Last Result */}
            {lastResult && (
              <Alert className={lastResult.success ? 'border-green-500' : 'border-red-500'}>
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-semibold">
                      {lastResult.success ? '✅ Order Executed' : '❌ Order Failed'}
                    </div>
                    <div className="text-sm space-y-1">
                      <div>Total: {lastResult.totalExecuted} @ {lastResult.averagePrice}</div>
                      <div>Settlement: {lastResult.settlementStatus}</div>
                      {lastResult.orderId && <div>ID: {lastResult.orderId}</div>}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Market Info */}
        <div className="space-y-6">
          {/* Market Data */}
          <Card>
            <CardHeader>
              <CardTitle>Market Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>AMM Price:</span>
                <span className="font-mono">{marketData.ammPrice}</span>
              </div>
              <div className="flex justify-between">
                <span>Best Bid:</span>
                <span className="font-mono">{marketData.orderbookBid}</span>
              </div>
              <div className="flex justify-between">
                <span>Best Ask:</span>
                <span className="font-mono">{marketData.orderbookAsk}</span>
              </div>
              <div className="flex justify-between">
                <span>AMM Liquidity:</span>
                <span className="font-mono">${marketData.ammLiquidity}</span>
              </div>
            </CardContent>
          </Card>

          {/* Execution Sources */}
          <Card>
            <CardHeader>
              <CardTitle>Execution Sources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-blue-50 rounded">
                <div className="font-semibold text-blue-900">🌊 AMM (On-chain)</div>
                <div className="text-sm text-blue-700">
                  • Immediate execution<br/>
                  • No settlement needed<br/>
                  • Higher gas fees
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded">
                <div className="font-semibold text-purple-900">📖 Orderbook (Hybrid)</div>
                <div className="text-sm text-purple-700">
                  • Off-chain matching<br/>
                  • On-chain settlement<br/>
                  • Lower gas fees
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Execution History */}
      {executionHistory.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Execution History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {executionHistory.map((result, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded">
                  <div className="flex justify-between text-sm">
                    <span>
                      {result.totalExecuted} @ {result.averagePrice}
                    </span>
                    <span className="text-gray-500">
                      {result.settlementStatus}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {result.executions.map(e => `${e.source}: ${e.amount}`).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}