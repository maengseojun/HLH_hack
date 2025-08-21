'use client';

/**
 * 🚀 HyperEVM Testnet Trading Interface
 * 
 * Features:
 * - Real wallet connection
 * - On-chain AMM swaps
 * - Testnet faucet
 * - Transaction monitoring
 * - Balance tracking
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Dynamic import workaround for Privy hooks
const { usePrivy } = require('@privy-io/react-auth');
import { ethers } from 'ethers';
import { HyperVMAMM } from '@/lib/blockchain/hypervm-amm';

// Official Hyperliquid testnet USDC token address
const OFFICIAL_TESTNET_USDC = '0xd9CBEC81df392A88AEff575E962d149d57F4d6bc';

// Contract addresses (will be populated from env vars)
const CONTRACT_ADDRESSES = {
  router: process.env.NEXT_PUBLIC_AMM_ROUTER_ADDRESS || '',
  factory: process.env.NEXT_PUBLIC_AMM_FACTORY_ADDRESS || '',
  hyperIndex: process.env.NEXT_PUBLIC_HYPERINDEX_TOKEN_ADDRESS || '',
  usdc: process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || OFFICIAL_TESTNET_USDC, // Use official USDC as fallback
  pair: process.env.NEXT_PUBLIC_HYPERINDEX_USDC_PAIR || ''
};

const HYPERVM_TESTNET = {
  chainId: '0x3e6', // 998 in hex
  chainName: 'HyperEVM Testnet',
  rpcUrls: [process.env.NEXT_PUBLIC_HYPERVM_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm'],
  nativeCurrency: {
    name: 'HYPE',
    symbol: 'HYPE',
    decimals: 18,
  },
  blockExplorerUrls: [process.env.NEXT_PUBLIC_HYPERVM_EXPLORER || 'https://explorer.hyperliquid-testnet.xyz']
};

const HYPERVM_MAINNET = {
  chainId: '0x3e7', // 999 in hex
  chainName: 'Hyperliquid',
  rpcUrls: ['https://rpc.hyperliquid.xyz/evm'],
  nativeCurrency: {
    name: 'HYPE',
    symbol: 'HYPE',
    decimals: 18,
  },
  blockExplorerUrls: ['https://explorer.hyperliquid.xyz']
};

const TESTNET_RPC = process.env.NEXT_PUBLIC_HYPERVM_TESTNET_RPC || 'https://rpc.hyperliquid-testnet.xyz/evm';

interface TokenBalance {
  hyperIndex: string;
  usdc: string;
  hype: string;
}

interface SwapState {
  tokenIn: 'HYPERINDEX' | 'USDC';
  tokenOut: 'HYPERINDEX' | 'USDC';
  amountIn: string;
  amountOut: string;
  priceImpact: number;
  isLoading: boolean;
}

export default function TestnetPage() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [isConnectedToTestnet, setIsConnectedToTestnet] = useState(false);
  const [amm, setAmm] = useState<HyperVMAMM | null>(null);
  const [balances, setBalances] = useState<TokenBalance>({
    hyperIndex: '0',
    usdc: '0',
    hype: '0'
  });
  const [swapState, setSwapState] = useState<SwapState>({
    tokenIn: 'USDC',
    tokenOut: 'HYPERINDEX',
    amountIn: '',
    amountOut: '',
    priceImpact: 0,
    isLoading: false
  });
  const [transactions, setTransactions] = useState<Array<{
    hash: string;
    type: string;
    status: 'pending' | 'success' | 'failed';
    timestamp: Date;
  }>>([]);

  // Initialize AMM when contracts are available
  useEffect(() => {
    if (CONTRACT_ADDRESSES.router && CONTRACT_ADDRESSES.factory && 
        CONTRACT_ADDRESSES.hyperIndex && CONTRACT_ADDRESSES.usdc && 
        CONTRACT_ADDRESSES.pair) {
      
      console.log('🔗 Initializing HyperVMAMM with contracts:', CONTRACT_ADDRESSES);
      const ammInstance = new HyperVMAMM(TESTNET_RPC, CONTRACT_ADDRESSES);
      setAmm(ammInstance);
    }
  }, []);

  // Check if connected to HyperEVM testnet
  useEffect(() => {
    checkNetwork();
  }, []);

  // Update balances and connect signer when authenticated and on testnet
  useEffect(() => {
    if (authenticated && isConnectedToTestnet && amm) {
      updateBalances();
      connectAMMSigner();
    }
  }, [authenticated, isConnectedToTestnet, amm]);

  const connectAMMSigner = async () => {
    if (!amm || !authenticated || typeof window === 'undefined' || !window.ethereum) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      amm.connectSigner(signer);
      console.log('🔗 AMM signer connected');
    } catch (error) {
      console.error('❌ Failed to connect AMM signer:', error);
    }
  };

  const checkNetwork = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        const isCorrectNetwork = chainId === HYPERVM_TESTNET.chainId;
        setIsConnectedToTestnet(isCorrectNetwork);
        
        if (amm && isCorrectNetwork) {
          const networkValid = await amm.verifyNetwork();
          console.log('🌐 Network verification:', networkValid);
        }
      } catch (error) {
        console.error('Failed to check network:', error);
      }
    }
  };

  const switchToTestnet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: HYPERVM_TESTNET.chainId }],
        });
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [HYPERVM_TESTNET],
            });
          } catch (addError) {
            console.error('Failed to add network:', addError);
          }
        } else {
          console.error('Failed to switch network:', switchError);
        }
      }
    }
  };

  const switchToMainnet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: HYPERVM_MAINNET.chainId }],
        });
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [HYPERVM_MAINNET],
            });
          } catch (addError) {
            console.error('Failed to add mainnet:', addError);
          }
        } else {
          console.error('Failed to switch to mainnet:', switchError);
        }
      }
    }
  };

  const addUSDCToWallet = async () => {
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'ERC20',
            options: {
              address: OFFICIAL_TESTNET_USDC,
              symbol: 'USDC',
              decimals: 6,
              image: '', // Optional token icon
            },
          },
        });
        console.log('✅ USDC token added to wallet');
      } catch (error) {
        console.error('❌ Failed to add USDC token:', error);
      }
    }
  };

  const updateBalances = async () => {
    if (!authenticated || !user?.wallet?.address || !amm) return;

    try {
      console.log('💰 Updating balances...');
      const userAddress = user.wallet.address;

      // Get HYPE balance
      const provider = new ethers.BrowserProvider(window.ethereum);
      const hypeBalance = await provider.getBalance(userAddress);
      
      // Get token balances using AMM
      const [hyperIndexBalance, usdcBalance] = await Promise.all([
        amm.getTokenBalance(CONTRACT_ADDRESSES.hyperIndex, userAddress),
        amm.getTokenBalance(CONTRACT_ADDRESSES.usdc, userAddress)
      ]);
      
      setBalances({
        hyperIndex: ethers.formatEther(hyperIndexBalance),
        usdc: ethers.formatUnits(usdcBalance, 6), // USDC has 6 decimals
        hype: ethers.formatEther(hypeBalance)
      });
      
      console.log('✅ Balances updated:', {
        hyperIndex: ethers.formatEther(hyperIndexBalance),
        usdc: ethers.formatUnits(usdcBalance, 6),
        hype: ethers.formatEther(hypeBalance)
      });
    } catch (error) {
      console.error('❌ Failed to update balances:', error);
      // Fallback to 0 if there's an error
      setBalances({
        hyperIndex: '0',
        usdc: '0',
        hype: '0'
      });
    }
  };

  const useFaucet = async () => {
    if (!authenticated || !amm) return;

    try {
      console.log('🚰 Using USDC faucet...');
      
      setTransactions(prev => [...prev, {
        hash: 'pending',
        type: 'USDC Faucet',
        status: 'pending',
        timestamp: new Date()
      }]);

      // Use real faucet function
      const txHash = await amm.useFaucet(CONTRACT_ADDRESSES.usdc);
      
      setTransactions(prev => prev.map(tx => 
        tx.hash === 'pending' && tx.type === 'USDC Faucet' 
          ? { ...tx, hash: txHash, status: 'success' } 
          : tx
      ));
      
      // Update balances after successful faucet
      await updateBalances();
      
      console.log('✅ Faucet successful:', txHash);
    } catch (error) {
      console.error('❌ Faucet failed:', error);
      
      setTransactions(prev => prev.map(tx => 
        tx.hash === 'pending' && tx.type === 'USDC Faucet'
          ? { ...tx, hash: 'failed', status: 'failed' } 
          : tx
      ));
    }
  };

  const executeSwap = async () => {
    if (!authenticated || !swapState.amountIn || !amm || !user?.wallet?.address) return;

    setSwapState(prev => ({ ...prev, isLoading: true }));

    try {
      console.log('🔄 Executing real blockchain swap...');
      
      const swapType = `Swap ${swapState.tokenIn} → ${swapState.tokenOut}`;
      setTransactions(prev => [...prev, {
        hash: 'pending',
        type: swapType,
        status: 'pending',
        timestamp: new Date()
      }]);

      // Prepare swap parameters
      const tokenInAddress = swapState.tokenIn === 'USDC' 
        ? CONTRACT_ADDRESSES.usdc 
        : CONTRACT_ADDRESSES.hyperIndex;
      const tokenOutAddress = swapState.tokenOut === 'USDC' 
        ? CONTRACT_ADDRESSES.usdc 
        : CONTRACT_ADDRESSES.hyperIndex;
      
      // Convert amount to proper decimals
      const decimals = swapState.tokenIn === 'USDC' ? 6 : 18;
      const amountIn = ethers.parseUnits(swapState.amountIn, decimals);

      // Execute real swap
      const swapResult = await amm.executeSwap({
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        amountIn: amountIn.toString(),
        slippageTolerance: 300, // 3%
        recipient: user.wallet.address
      });
      
      console.log('✅ Swap completed:', swapResult);
      
      setTransactions(prev => prev.map(tx => 
        tx.hash === 'pending' && tx.type === swapType
          ? { ...tx, hash: swapResult.hash, status: 'success' } 
          : tx
      ));
      
      // Update balances and clear swap form
      await updateBalances();
      setSwapState(prev => ({ ...prev, amountIn: '', amountOut: '', priceImpact: 0 }));
      
    } catch (error) {
      console.error('❌ Swap failed:', error);
      
      const swapType = `Swap ${swapState.tokenIn} → ${swapState.tokenOut}`;
      setTransactions(prev => prev.map(tx => 
        tx.hash === 'pending' && tx.type === swapType
          ? { ...tx, hash: 'failed', status: 'failed' } 
          : tx
      ));
    } finally {
      setSwapState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const getSwapQuote = async (amountIn: string) => {
    if (!amountIn || parseFloat(amountIn) <= 0 || !amm) {
      setSwapState(prev => ({ ...prev, amountOut: '', priceImpact: 0 }));
      return;
    }

    try {
      // Prepare token addresses and amount
      const tokenInAddress = swapState.tokenIn === 'USDC' 
        ? CONTRACT_ADDRESSES.usdc 
        : CONTRACT_ADDRESSES.hyperIndex;
      const tokenOutAddress = swapState.tokenOut === 'USDC' 
        ? CONTRACT_ADDRESSES.usdc 
        : CONTRACT_ADDRESSES.hyperIndex;
      
      const decimals = swapState.tokenIn === 'USDC' ? 6 : 18;
      const amountInParsed = ethers.parseUnits(amountIn, decimals);

      // Get real quote from AMM
      const quote = await amm.getSwapQuote(
        tokenInAddress,
        tokenOutAddress,
        amountInParsed.toString()
      );
      
      // Format amount out based on output token decimals
      const outDecimals = swapState.tokenOut === 'USDC' ? 6 : 18;
      const amountOut = ethers.formatUnits(quote.amountOut, outDecimals);

      setSwapState(prev => ({
        ...prev,
        amountOut,
        priceImpact: quote.priceImpact
      }));
      
      console.log('💸 Quote updated:', {
        amountIn,
        amountOut,
        priceImpact: quote.priceImpact
      });
      
    } catch (error) {
      console.error('❌ Failed to get quote:', error);
      // Fallback to mock calculation
      const rate = swapState.tokenIn === 'USDC' ? 1.02 : 0.98;
      const amountOut = (parseFloat(amountIn) * rate).toFixed(6);
      const priceImpact = Math.min(parseFloat(amountIn) / 10000 * 100, 5);

      setSwapState(prev => ({
        ...prev,
        amountOut,
        priceImpact
      }));
    }
  };

  const switchTokens = () => {
    setSwapState(prev => ({
      ...prev,
      tokenIn: prev.tokenOut,
      tokenOut: prev.tokenIn,
      amountIn: prev.amountOut,
      amountOut: prev.amountIn
    }));
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">🚀 HyperEVM Testnet Trading</h1>
          <p className="text-gray-400">Real on-chain AMM testing on HyperEVM testnet</p>
          
          {/* Network Status */}
          <div className="mt-4 flex justify-center space-x-2 flex-wrap">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isConnectedToTestnet ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isConnectedToTestnet ? '✅ HyperEVM Testnet' : '❌ Wrong Network'}
            </span>
            
            {authenticated && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                🔗 Wallet Connected
              </span>
            )}
            
            {amm && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                🎯 AMM Ready
              </span>
            )}
            
            {!CONTRACT_ADDRESSES.router && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                ⚠️ Contracts Not Deployed
              </span>
            )}
          </div>
          
          {!CONTRACT_ADDRESSES.router && (
            <div className="mt-2 p-3 bg-yellow-900 border border-yellow-700 rounded text-sm">
              <p className="text-yellow-300">
                📝 Contracts not yet deployed to testnet. Run deployment script first.
              </p>
              <p className="text-yellow-200 text-xs mt-1">
                💡 If you received USDC from faucet but can't see it in MetaMask, you need to add the token manually after deployment.
              </p>
            </div>
          )}
        </div>

        {/* Connection Section */}
        {!authenticated ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-center">Connect Wallet</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={login} className="mb-4">
                🦊 Connect Wallet
              </Button>
              <p className="text-sm text-gray-400">
                Connect your wallet to start trading on HyperEVM testnet
              </p>
            </CardContent>
          </Card>
        ) : !isConnectedToTestnet ? (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-center">Switch to HyperEVM Network</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <Button onClick={switchToTestnet} className="w-full">
                🧪 Switch to Testnet
              </Button>
              <Button onClick={switchToMainnet} variant="outline" className="w-full">
                🚀 Switch to Mainnet
              </Button>
              <p className="text-sm text-gray-400">
                Choose testnet for safe testing or mainnet for live trading
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Balances */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle>💰 Your Balances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>HYPE:</span>
                  <span>{parseFloat(balances.hype).toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span>HYPERINDEX:</span>
                  <span>{parseFloat(balances.hyperIndex).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>USDC:</span>
                  <span>{parseFloat(balances.usdc).toFixed(2)}</span>
                </div>
                
                <Button onClick={useFaucet} className="w-full mt-4" variant="outline">
                  🚰 Get Testnet USDC
                </Button>
                <Button onClick={updateBalances} className="w-full" variant="outline">
                  🔄 Refresh Balances
                </Button>
                <Button onClick={addUSDCToWallet} className="w-full" variant="outline">
                  ➕ Add USDC to Wallet
                </Button>
              </CardContent>
            </Card>

            {/* Swap Interface */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle>🔄 Token Swap</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Token In */}
                <div>
                  <Label>From</Label>
                  <div className="flex space-x-2">
                    <Input
                      value={swapState.amountIn}
                      onChange={(e) => {
                        const value = e.target.value;
                        setSwapState(prev => ({ ...prev, amountIn: value }));
                        getSwapQuote(value);
                      }}
                      placeholder="0.00"
                      className="bg-gray-700 border-gray-600"
                    />
                    <Button variant="outline" className="min-w-[100px]">
                      {swapState.tokenIn}
                    </Button>
                  </div>
                </div>

                {/* Swap Direction */}
                <div className="flex justify-center">
                  <Button onClick={switchTokens} variant="ghost" size="sm">
                    ↕️
                  </Button>
                </div>

                {/* Token Out */}
                <div>
                  <Label>To</Label>
                  <div className="flex space-x-2">
                    <Input
                      value={swapState.amountOut}
                      placeholder="0.00"
                      readOnly
                      className="bg-gray-700 border-gray-600"
                    />
                    <Button variant="outline" className="min-w-[100px]">
                      {swapState.tokenOut}
                    </Button>
                  </div>
                </div>

                {/* Price Impact */}
                {swapState.priceImpact > 0 && (
                  <div className="text-sm">
                    <div className="flex justify-between">
                      <span>Price Impact:</span>
                      <span className={swapState.priceImpact > 3 ? 'text-red-400' : 'text-green-400'}>
                        {swapState.priceImpact.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}

                <Button 
                  onClick={executeSwap} 
                  className="w-full"
                  disabled={!swapState.amountIn || swapState.isLoading}
                >
                  {swapState.isLoading ? '⏳ Swapping...' : '🔄 Swap Tokens'}
                </Button>
              </CardContent>
            </Card>

            {/* Transaction History */}
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle>📋 Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-gray-400 text-center">No transactions yet</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.slice(-5).reverse().map((tx, index) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-gray-700 rounded">
                        <div>
                          <div className="text-sm font-medium">{tx.type}</div>
                          <div className="text-xs text-gray-400">
                            {tx.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${
                            tx.status === 'pending' ? 'bg-yellow-400' :
                            tx.status === 'success' ? 'bg-green-400' : 'bg-red-400'
                          }`}></span>
                          {tx.hash !== 'pending' && (
                            <a 
                              href={`${HYPERVM_TESTNET.blockExplorerUrls[0]}/tx/${tx.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300 text-xs"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-400">Testnet</div>
              <div className="text-sm text-gray-400">Safe Testing Environment</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-400">Real Contracts</div>
              <div className="text-sm text-gray-400">Deployed on HyperEVM</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">Free Tokens</div>
              <div className="text-sm text-gray-400">Faucet Available</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400">Live Trades</div>
              <div className="text-sm text-gray-400">Real Blockchain TXs</div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-400">
          <p>🚀 HyperIndex AMM on HyperEVM Testnet</p>
          <p>⚠️ This is a testnet environment - tokens have no real value</p>
        </div>
      </div>
    </div>
  );
}