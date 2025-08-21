import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { web3Manager } from './web3Manager';

/**
 * Custom React hooks for Web3 integration
 */

// Hook for wallet connection
export function useWallet() {
    const [account, setAccount] = useState<string | null>(null);
    const [balance, setBalance] = useState<bigint>(BigInt(0));
    const [chainId, setChainId] = useState<number | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Connect wallet
    const connect = useCallback(async () => {
        setIsConnecting(true);
        setError(null);
        
        try {
            const address = await web3Manager.connectWallet();
            setAccount(address);
            
            // Get network info
            const network = await web3Manager.getNetwork();
            setChainId(Number(network.chainId));
            
            // Load contract addresses
            await web3Manager.loadContractAddresses(network.name);
            
            // Get ETH balance
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const balance = await provider.getBalance(address);
            setBalance(balance);
            
        } catch (err: any) {
            setError(err.message || 'Failed to connect wallet');
        } finally {
            setIsConnecting(false);
        }
    }, []);
    
    // Disconnect wallet
    const disconnect = useCallback(() => {
        setAccount(null);
        setBalance(BigInt(0));
        setChainId(null);
    }, []);
    
    // Auto-connect on mount if previously connected
    useEffect(() => {
        const checkConnection = async () => {
            if ((window as any).ethereum) {
                const provider = new ethers.BrowserProvider((window as any).ethereum);
                const accounts = await provider.listAccounts();
                
                if (accounts.length > 0) {
                    connect();
                }
            }
        };
        
        checkConnection();
    }, [connect]);
    
    return {
        account,
        balance,
        chainId,
        isConnecting,
        error,
        connect,
        disconnect,
        isConnected: !!account
    };
}

// Hook for index fund operations
export function useIndexFund() {
    const [isCreating, setIsCreating] = useState(false);
    const [funds, setFunds] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    
    // Create index fund
    const createFund = useCallback(async (
        name: string,
        symbol: string,
        components: Array<{ tokenAddress: string; targetRatio: number }>
    ) => {
        setIsCreating(true);
        setError(null);
        
        try {
            const tx = await web3Manager.createIndexFund(name, symbol, components);
            const receipt = await web3Manager.waitForTransaction(tx);
            
            if (receipt && receipt.status === 1) {
                console.log('Fund created successfully');
                // Refresh funds list
                await loadFunds();
                return receipt;
            } else {
                throw new Error('Transaction failed');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create fund');
            throw err;
        } finally {
            setIsCreating(false);
        }
    }, []);
    
    // Load user's funds
    const loadFunds = useCallback(async () => {
        try {
            // This would typically fetch from a subgraph or events
            // For now, returning empty array
            setFunds([]);
        } catch (err: any) {
            setError(err.message || 'Failed to load funds');
        }
    }, []);
    
    // Get fund details
    const getFundDetails = useCallback(async (fundId: string) => {
        try {
            return await web3Manager.getFundDetails(fundId);
        } catch (err: any) {
            setError(err.message || 'Failed to get fund details');
            throw err;
        }
    }, []);
    
    return {
        funds,
        isCreating,
        error,
        createFund,
        loadFunds,
        getFundDetails
    };
}

// Hook for vault operations
export function useVault() {
    const [shares, setShares] = useState<bigint>(BigInt(0));
    const [totalAssets, setTotalAssets] = useState<bigint>(BigInt(0));
    const [isDepositing, setIsDepositing] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Load vault data
    const loadVaultData = useCallback(async (account: string) => {
        try {
            const vault = web3Manager.getContract('vault');
            const [userShares, vaultAssets] = await Promise.all([
                web3Manager.getVaultShares(account),
                vault.totalAssets()
            ]);
            
            setShares(userShares);
            setTotalAssets(vaultAssets);
        } catch (err: any) {
            setError(err.message || 'Failed to load vault data');
        }
    }, []);
    
    // Deposit to vault
    const deposit = useCallback(async (amount: bigint, recipient: string) => {
        setIsDepositing(true);
        setError(null);
        
        try {
            // First approve token
            const vault = web3Manager.getContract('vault');
            const assetAddress = await vault.asset();
            
            const approveTx = await web3Manager.approveToken(
                assetAddress,
                await vault.getAddress(),
                amount
            );
            await web3Manager.waitForTransaction(approveTx);
            
            // Then deposit
            const depositTx = await web3Manager.depositToVault(amount, recipient);
            const receipt = await web3Manager.waitForTransaction(depositTx);
            
            if (receipt && receipt.status === 1) {
                console.log('Deposit successful');
                await loadVaultData(recipient);
                return receipt;
            } else {
                throw new Error('Deposit failed');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to deposit');
            throw err;
        } finally {
            setIsDepositing(false);
        }
    }, [loadVaultData]);
    
    // Withdraw from vault
    const withdraw = useCallback(async (shares: bigint, recipient: string) => {
        setIsWithdrawing(true);
        setError(null);
        
        try {
            const vault = web3Manager.getContract('vault');
            const tx = await vault.redeem(shares, recipient, recipient);
            const receipt = await web3Manager.waitForTransaction(tx);
            
            if (receipt && receipt.status === 1) {
                console.log('Withdrawal successful');
                await loadVaultData(recipient);
                return receipt;
            } else {
                throw new Error('Withdrawal failed');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to withdraw');
            throw err;
        } finally {
            setIsWithdrawing(false);
        }
    }, [loadVaultData]);
    
    // Preview deposit
    const previewDeposit = useCallback(async (amount: bigint): Promise<bigint> => {
        try {
            const vault = web3Manager.getContract('vault');
            return await vault.previewDeposit(amount);
        } catch (err: any) {
            setError(err.message || 'Failed to preview deposit');
            throw err;
        }
    }, []);
    
    // Preview redeem
    const previewRedeem = useCallback(async (shares: bigint): Promise<bigint> => {
        try {
            const vault = web3Manager.getContract('vault');
            return await vault.previewRedeem(shares);
        } catch (err: any) {
            setError(err.message || 'Failed to preview redeem');
            throw err;
        }
    }, []);
    
    return {
        shares,
        totalAssets,
        isDepositing,
        isWithdrawing,
        error,
        deposit,
        withdraw,
        loadVaultData,
        previewDeposit,
        previewRedeem
    };
}

// Hook for DEX aggregator
export function useDEXAggregator() {
    const [isSwapping, setIsSwapping] = useState(false);
    const [bestRoute, setBestRoute] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Find optimal route
    const findRoute = useCallback(async (
        tokenIn: string,
        tokenOut: string,
        amountIn: bigint
    ) => {
        setError(null);
        
        try {
            const route = await web3Manager.findOptimalRoute(tokenIn, tokenOut, amountIn);
            setBestRoute(route);
            return route;
        } catch (err: any) {
            setError(err.message || 'Failed to find route');
            throw err;
        }
    }, []);
    
    // Execute swap
    const executeSwap = useCallback(async (
        tokenIn: string,
        tokenOut: string,
        amountIn: bigint,
        minAmountOut: bigint
    ) => {
        setIsSwapping(true);
        setError(null);
        
        try {
            // Approve token first
            const aggregator = web3Manager.getContract('aggregator');
            const approveTx = await web3Manager.approveToken(
                tokenIn,
                await aggregator.getAddress(),
                amountIn
            );
            await web3Manager.waitForTransaction(approveTx);
            
            // Execute swap
            const swapTx = await web3Manager.executeSwap(
                tokenIn,
                tokenOut,
                amountIn,
                minAmountOut
            );
            const receipt = await web3Manager.waitForTransaction(swapTx);
            
            if (receipt && receipt.status === 1) {
                console.log('Swap successful');
                return receipt;
            } else {
                throw new Error('Swap failed');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to execute swap');
            throw err;
        } finally {
            setIsSwapping(false);
        }
    }, []);
    
    return {
        isSwapping,
        bestRoute,
        error,
        findRoute,
        executeSwap
    };
}

// Hook for token operations
export function useToken(tokenAddress: string) {
    const [balance, setBalance] = useState<bigint>(BigInt(0));
    const [allowance, setAllowance] = useState<bigint>(BigInt(0));
    const [decimals, setDecimals] = useState<number>(18);
    const [symbol, setSymbol] = useState<string>('');
    const [name, setName] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Load token data
    const loadTokenData = useCallback(async (account: string, spender?: string) => {
        if (!tokenAddress || !web3Manager.isValidAddress(tokenAddress)) {
            return;
        }
        
        setIsLoading(true);
        setError(null);
        
        try {
            const token = web3Manager.getTokenContract(tokenAddress);
            
            const [
                userBalance,
                tokenDecimals,
                tokenSymbol,
                tokenName
            ] = await Promise.all([
                token.balanceOf(account),
                token.decimals(),
                token.symbol(),
                token.name()
            ]);
            
            setBalance(userBalance);
            setDecimals(Number(tokenDecimals));
            setSymbol(tokenSymbol);
            setName(tokenName);
            
            if (spender) {
                const tokenAllowance = await token.allowance(account, spender);
                setAllowance(tokenAllowance);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load token data');
        } finally {
            setIsLoading(false);
        }
    }, [tokenAddress]);
    
    // Approve token
    const approve = useCallback(async (spender: string, amount: bigint) => {
        setError(null);
        
        try {
            const tx = await web3Manager.approveToken(tokenAddress, spender, amount);
            const receipt = await web3Manager.waitForTransaction(tx);
            
            if (receipt && receipt.status === 1) {
                setAllowance(amount);
                return receipt;
            } else {
                throw new Error('Approval failed');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to approve token');
            throw err;
        }
    }, [tokenAddress]);
    
    return {
        balance,
        allowance,
        decimals,
        symbol,
        name,
        isLoading,
        error,
        loadTokenData,
        approve
    };
}

// Hook for transaction handling
export function useTransaction() {
    const [pendingTx, setPendingTx] = useState<string | null>(null);
    const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
    const [error, setError] = useState<string | null>(null);
    
    // Execute transaction
    const execute = useCallback(async (
        txPromise: Promise<ethers.ContractTransactionResponse>
    ) => {
        setTxStatus('pending');
        setError(null);
        
        try {
            const tx = await txPromise;
            setPendingTx(tx.hash);
            
            const receipt = await web3Manager.waitForTransaction(tx);
            
            if (receipt && receipt.status === 1) {
                setTxStatus('success');
                return receipt;
            } else {
                throw new Error('Transaction failed');
            }
        } catch (err: any) {
            setTxStatus('error');
            setError(err.message || 'Transaction failed');
            throw err;
        } finally {
            setPendingTx(null);
        }
    }, []);
    
    return {
        pendingTx,
        txStatus,
        error,
        execute
    };
}

// Hook for gas estimation
export function useGasEstimate() {
    const [gasPrice, setGasPrice] = useState<bigint>(BigInt(0));
    const [estimatedGas, setEstimatedGas] = useState<bigint>(BigInt(0));
    const [isEstimating, setIsEstimating] = useState(false);
    
    // Get current gas price
    const updateGasPrice = useCallback(async () => {
        try {
            const price = await web3Manager.getGasPrice();
            setGasPrice(price);
        } catch (err) {
            console.error('Failed to get gas price:', err);
        }
    }, []);
    
    // Estimate gas for transaction
    const estimateGas = useCallback(async (
        contract: string,
        method: string,
        args: any[]
    ) => {
        setIsEstimating(true);
        
        try {
            const gas = await web3Manager.estimateGas(contract, method, args);
            setEstimatedGas(gas);
            return gas;
        } catch (err) {
            console.error('Failed to estimate gas:', err);
            return BigInt(0);
        } finally {
            setIsEstimating(false);
        }
    }, []);
    
    // Auto-update gas price
    useEffect(() => {
        updateGasPrice();
        const interval = setInterval(updateGasPrice, 15000); // Update every 15 seconds
        return () => clearInterval(interval);
    }, [updateGasPrice]);
    
    return {
        gasPrice,
        estimatedGas,
        isEstimating,
        estimateGas,
        updateGasPrice,
        totalCost: gasPrice * estimatedGas
    };
}
