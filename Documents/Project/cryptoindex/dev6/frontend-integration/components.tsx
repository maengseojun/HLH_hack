import React, { useState, useEffect } from 'react';
import { 
    useWallet, 
    useIndexFund, 
    useVault, 
    useDEXAggregator,
    useToken,
    useTransaction,
    useGasEstimate 
} from './hooks';
import { web3Manager } from './web3Manager';

/**
 * Example React components for Hyperliquid Index Platform
 */

// Wallet Connection Component
export const WalletConnect: React.FC = () => {
    const { account, balance, chainId, isConnecting, error, connect, disconnect, isConnected } = useWallet();
    
    return (
        <div className="wallet-connect">
            {!isConnected ? (
                <button 
                    onClick={connect} 
                    disabled={isConnecting}
                    className="btn btn-primary"
                >
                    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
            ) : (
                <div className="wallet-info">
                    <p>Account: {account?.slice(0, 6)}...{account?.slice(-4)}</p>
                    <p>Balance: {web3Manager.formatEther(balance)} ETH</p>
                    <p>Chain ID: {chainId}</p>
                    <button onClick={disconnect} className="btn btn-secondary">
                        Disconnect
                    </button>
                </div>
            )}
            {error && <p className="error">{error}</p>}
        </div>
    );
};

// Create Index Fund Component
export const CreateIndexFund: React.FC = () => {
    const { createFund, isCreating, error } = useIndexFund();
    const { execute, txStatus } = useTransaction();
    const { estimateGas, gasPrice, totalCost } = useGasEstimate();
    
    const [fundName, setFundName] = useState('');
    const [fundSymbol, setFundSymbol] = useState('');
    const [components, setComponents] = useState<Array<{ tokenAddress: string; targetRatio: number }>>([
        { tokenAddress: '', targetRatio: 0 }
    ]);
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        try {
            // Estimate gas first
            await estimateGas('factory', 'createIndexFund', [fundName, fundSymbol, components]);
            
            // Create fund
            const txPromise = createFund(fundName, fundSymbol, components);
            await execute(txPromise);
            
            // Reset form
            setFundName('');
            setFundSymbol('');
            setComponents([{ tokenAddress: '', targetRatio: 0 }]);
        } catch (err) {
            console.error('Failed to create fund:', err);
        }
    };
    
    const addComponent = () => {
        setComponents([...components, { tokenAddress: '', targetRatio: 0 }]);
    };
    
    const updateComponent = (index: number, field: 'tokenAddress' | 'targetRatio', value: string | number) => {
        const newComponents = [...components];
        if (field === 'tokenAddress') {
            newComponents[index].tokenAddress = value as string;
        } else {
            newComponents[index].targetRatio = Number(value);
        }
        setComponents(newComponents);
    };
    
    const removeComponent = (index: number) => {
        setComponents(components.filter((_, i) => i !== index));
    };
    
    const totalRatio = components.reduce((sum, c) => sum + c.targetRatio, 0);
    
    return (
        <div className="create-fund">
            <h2>Create Index Fund</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Fund Name</label>
                    <input
                        type="text"
                        value={fundName}
                        onChange={(e) => setFundName(e.target.value)}
                        placeholder="e.g., DeFi Blue Chip Index"
                        required
                    />
                </div>
                
                <div className="form-group">
                    <label>Fund Symbol</label>
                    <input
                        type="text"
                        value={fundSymbol}
                        onChange={(e) => setFundSymbol(e.target.value)}
                        placeholder="e.g., DBI"
                        required
                    />
                </div>
                
                <div className="components">
                    <h3>Components</h3>
                    {components.map((component, index) => (
                        <div key={index} className="component-row">
                            <input
                                type="text"
                                value={component.tokenAddress}
                                onChange={(e) => updateComponent(index, 'tokenAddress', e.target.value)}
                                placeholder="Token Address"
                                required
                            />
                            <input
                                type="number"
                                value={component.targetRatio}
                                onChange={(e) => updateComponent(index, 'targetRatio', e.target.value)}
                                placeholder="Ratio (basis points)"
                                min="0"
                                max="10000"
                                required
                            />
                            <button 
                                type="button" 
                                onClick={() => removeComponent(index)}
                                disabled={components.length === 1}
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                    <button type="button" onClick={addComponent}>
                        Add Component
                    </button>
                    <p>Total Ratio: {totalRatio} / 10000 ({totalRatio / 100}%)</p>
                    {totalRatio !== 10000 && (
                        <p className="warning">Total ratio must equal 10000 (100%)</p>
                    )}
                </div>
                
                {totalCost > 0n && (
                    <div className="gas-estimate">
                        <p>Estimated Gas Cost: {web3Manager.formatEther(totalCost)} ETH</p>
                    </div>
                )}
                
                <button 
                    type="submit" 
                    disabled={isCreating || totalRatio !== 10000 || txStatus === 'pending'}
                    className="btn btn-primary"
                >
                    {isCreating ? 'Creating...' : 'Create Fund'}
                </button>
            </form>
            
            {txStatus === 'success' && (
                <p className="success">Fund created successfully!</p>
            )}
            {error && <p className="error">{error}</p>}
        </div>
    );
};

// Vault Deposit Component
export const VaultDeposit: React.FC<{ vaultAddress: string; assetAddress: string }> = ({ 
    vaultAddress, 
    assetAddress 
}) => {
    const { account } = useWallet();
    const { deposit, isDepositing, shares, totalAssets, loadVaultData, previewDeposit } = useVault();
    const { balance, symbol, loadTokenData, approve } = useToken(assetAddress);
    const [amount, setAmount] = useState('');
    const [expectedShares, setExpectedShares] = useState<bigint>(BigInt(0));
    
    useEffect(() => {
        if (account) {
            loadVaultData(account);
            loadTokenData(account, vaultAddress);
        }
    }, [account, loadVaultData, loadTokenData, vaultAddress]);
    
    useEffect(() => {
        const updatePreview = async () => {
            if (amount && parseFloat(amount) > 0) {
                try {
                    const amountBigInt = web3Manager.parseEther(amount);
                    const shares = await previewDeposit(amountBigInt);
                    setExpectedShares(shares);
                } catch (err) {
                    console.error('Failed to preview deposit:', err);
                }
            } else {
                setExpectedShares(BigInt(0));
            }
        };
        
        updatePreview();
    }, [amount, previewDeposit]);
    
    const handleDeposit = async () => {
        if (!account || !amount) return;
        
        try {
            const amountBigInt = web3Manager.parseEther(amount);
            await deposit(amountBigInt, account);
            setAmount('');
        } catch (err) {
            console.error('Failed to deposit:', err);
        }
    };
    
    return (
        <div className="vault-deposit">
            <h3>Vault Deposit</h3>
            
            <div className="vault-stats">
                <p>Total Assets: {web3Manager.formatEther(totalAssets)} {symbol}</p>
                <p>Your Shares: {web3Manager.formatEther(shares)}</p>
                <p>Your Balance: {web3Manager.formatEther(balance)} {symbol}</p>
            </div>
            
            <div className="deposit-form">
                <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount to deposit"
                    min="0"
                    step="0.01"
                />
                
                {expectedShares > 0n && (
                    <p>Expected Shares: {web3Manager.formatEther(expectedShares)}</p>
                )}
                
                <button 
                    onClick={handleDeposit}
                    disabled={isDepositing || !amount || parseFloat(amount) <= 0}
                    className="btn btn-primary"
                >
                    {isDepositing ? 'Depositing...' : 'Deposit'}
                </button>
            </div>
        </div>
    );
};

// DEX Swap Component
export const DEXSwap: React.FC = () => {
    const { account } = useWallet();
    const { findRoute, executeSwap, isSwapping, bestRoute } = useDEXAggregator();
    const [tokenIn, setTokenIn] = useState('');
    const [tokenOut, setTokenOut] = useState('');
    const [amountIn, setAmountIn] = useState('');
    const [slippage, setSlippage] = useState('0.5');
    
    const handleFindRoute = async () => {
        if (!tokenIn || !tokenOut || !amountIn) return;
        
        try {
            const amount = web3Manager.parseEther(amountIn);
            await findRoute(tokenIn, tokenOut, amount);
        } catch (err) {
            console.error('Failed to find route:', err);
        }
    };
    
    const handleSwap = async () => {
        if (!bestRoute || !account) return;
        
        try {
            const amount = web3Manager.parseEther(amountIn);
            const minOut = (bestRoute.expectedOut * BigInt(10000 - parseFloat(slippage) * 100)) / BigInt(10000);
            
            await executeSwap(tokenIn, tokenOut, amount, minOut);
            setAmountIn('');
        } catch (err) {
            console.error('Failed to execute swap:', err);
        }
    };
    
    return (
        <div className="dex-swap">
            <h3>DEX Aggregator Swap</h3>
            
            <div className="swap-form">
                <div className="form-group">
                    <label>From Token</label>
                    <input
                        type="text"
                        value={tokenIn}
                        onChange={(e) => setTokenIn(e.target.value)}
                        placeholder="Token address"
                    />
                </div>
                
                <div className="form-group">
                    <label>To Token</label>
                    <input
                        type="text"
                        value={tokenOut}
                        onChange={(e) => setTokenOut(e.target.value)}
                        placeholder="Token address"
                    />
                </div>
                
                <div className="form-group">
                    <label>Amount</label>
                    <input
                        type="number"
                        value={amountIn}
                        onChange={(e) => setAmountIn(e.target.value)}
                        placeholder="0.0"
                        min="0"
                        step="0.01"
                    />
                </div>
                
                <div className="form-group">
                    <label>Slippage Tolerance (%)</label>
                    <input
                        type="number"
                        value={slippage}
                        onChange={(e) => setSlippage(e.target.value)}
                        min="0.1"
                        max="5"
                        step="0.1"
                    />
                </div>
                
                <button 
                    onClick={handleFindRoute}
                    disabled={!tokenIn || !tokenOut || !amountIn}
                    className="btn btn-secondary"
                >
                    Find Best Route
                </button>
                
                {bestRoute && (
                    <div className="route-info">
                        <p>Best DEX: {bestRoute.bestDEX}</p>
                        <p>Expected Output: {web3Manager.formatEther(bestRoute.expectedOut)}</p>
                        
                        <button 
                            onClick={handleSwap}
                            disabled={isSwapping}
                            className="btn btn-primary"
                        >
                            {isSwapping ? 'Swapping...' : 'Execute Swap'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

// Main App Component
export const IndexPlatformApp: React.FC = () => {
    return (
        <div className="index-platform-app">
            <header>
                <h1>Hyperliquid Index Platform</h1>
                <WalletConnect />
            </header>
            
            <main>
                <div className="container">
                    <div className="grid">
                        <div className="card">
                            <CreateIndexFund />
                        </div>
                        
                        <div className="card">
                            <VaultDeposit 
                                vaultAddress="0x..." // Replace with actual addresses
                                assetAddress="0x..."
                            />
                        </div>
                        
                        <div className="card">
                            <DEXSwap />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default IndexPlatformApp;
