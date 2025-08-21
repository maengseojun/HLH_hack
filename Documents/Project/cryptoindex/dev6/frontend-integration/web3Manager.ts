import { ethers } from 'ethers';
import { 
    IndexTokenFactoryABI,
    SmartIndexVaultABI,
    MultiDEXAggregatorABI,
    MockERC20ABI
} from '../abi/types';

/**
 * Web3 Connection Manager for Hyperliquid Index Platform
 */
export class Web3Manager {
    private provider: ethers.BrowserProvider | null = null;
    private signer: ethers.Signer | null = null;
    private contracts: Map<string, ethers.Contract> = new Map();
    private networkConfig: any = {};
    
    constructor() {
        this.initializeProvider();
    }
    
    /**
     * Initialize Web3 provider
     */
    async initializeProvider(): Promise<void> {
        if (typeof window !== 'undefined' && (window as any).ethereum) {
            this.provider = new ethers.BrowserProvider((window as any).ethereum);
            
            // Listen for account changes
            (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
                console.log('Accounts changed:', accounts);
                this.handleAccountsChanged(accounts);
            });
            
            // Listen for chain changes
            (window as any).ethereum.on('chainChanged', (chainId: string) => {
                console.log('Chain changed:', chainId);
                window.location.reload();
            });
        } else {
            console.warn('No Web3 provider detected');
        }
    }
    
    /**
     * Connect wallet
     */
    async connectWallet(): Promise<string> {
        if (!this.provider) {
            throw new Error('No Web3 provider available');
        }
        
        try {
            // Request account access
            await (window as any).ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            this.signer = await this.provider.getSigner();
            const address = await this.signer.getAddress();
            
            console.log('Wallet connected:', address);
            return address;
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            throw error;
        }
    }
    
    /**
     * Get current network
     */
    async getNetwork(): Promise<ethers.Network> {
        if (!this.provider) {
            throw new Error('No provider available');
        }
        return await this.provider.getNetwork();
    }
    
    /**
     * Load contract addresses from deployment file
     */
    async loadContractAddresses(networkName: string): Promise<void> {
        try {
            const response = await fetch(`/deployments/${networkName}.json`);
            const deployment = await response.json();
            this.networkConfig = deployment.contracts;
        } catch (error) {
            console.error('Failed to load contract addresses:', error);
            // Use default addresses for development
            this.networkConfig = {
                factory: process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '',
                vault: process.env.NEXT_PUBLIC_VAULT_ADDRESS || '',
                aggregator: process.env.NEXT_PUBLIC_AGGREGATOR_ADDRESS || '',
                priceFeed: process.env.NEXT_PUBLIC_PRICE_FEED_ADDRESS || ''
            };
        }
    }
    
    /**
     * Get contract instance
     */
    getContract(name: string): ethers.Contract {
        if (this.contracts.has(name)) {
            return this.contracts.get(name)!;
        }
        
        if (!this.signer) {
            throw new Error('Wallet not connected');
        }
        
        let address: string;
        let abi: any;
        
        switch (name) {
            case 'factory':
                address = this.networkConfig.factory;
                abi = IndexTokenFactoryABI;
                break;
            case 'vault':
                address = this.networkConfig.vault;
                abi = SmartIndexVaultABI;
                break;
            case 'aggregator':
                address = this.networkConfig.aggregator;
                abi = MultiDEXAggregatorABI;
                break;
            default:
                throw new Error(`Unknown contract: ${name}`);
        }
        
        const contract = new ethers.Contract(address, abi, this.signer);
        this.contracts.set(name, contract);
        
        return contract;
    }
    
    /**
     * Get token contract
     */
    getTokenContract(address: string): ethers.Contract {
        if (!this.signer) {
            throw new Error('Wallet not connected');
        }
        
        const key = `token_${address}`;
        if (this.contracts.has(key)) {
            return this.contracts.get(key)!;
        }
        
        const contract = new ethers.Contract(address, MockERC20ABI, this.signer);
        this.contracts.set(key, contract);
        
        return contract;
    }
    
    /**
     * Create index fund
     */
    async createIndexFund(
        name: string,
        symbol: string,
        components: Array<{ tokenAddress: string; targetRatio: number }>
    ): Promise<ethers.ContractTransactionResponse> {
        const factory = this.getContract('factory');
        return await factory.createIndexFund(name, symbol, components);
    }
    
    /**
     * Deposit to vault
     */
    async depositToVault(
        amount: bigint,
        recipient: string
    ): Promise<ethers.ContractTransactionResponse> {
        const vault = this.getContract('vault');
        return await vault.deposit(amount, recipient);
    }
    
    /**
     * Execute swap
     */
    async executeSwap(
        tokenIn: string,
        tokenOut: string,
        amountIn: bigint,
        minAmountOut: bigint
    ): Promise<ethers.ContractTransactionResponse> {
        const aggregator = this.getContract('aggregator');
        
        const swapRequest = {
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            recipient: await this.signer!.getAddress(),
            deadline: Math.floor(Date.now() / 1000) + 300, // 5 minutes
            routeData: '0x'
        };
        
        return await aggregator.executeSwap(swapRequest);
    }
    
    /**
     * Approve token spending
     */
    async approveToken(
        tokenAddress: string,
        spender: string,
        amount: bigint
    ): Promise<ethers.ContractTransactionResponse> {
        const token = this.getTokenContract(tokenAddress);
        return await token.approve(spender, amount);
    }
    
    /**
     * Get token balance
     */
    async getTokenBalance(
        tokenAddress: string,
        account: string
    ): Promise<bigint> {
        const token = this.getTokenContract(tokenAddress);
        return await token.balanceOf(account);
    }
    
    /**
     * Get vault shares balance
     */
    async getVaultShares(account: string): Promise<bigint> {
        const vault = this.getContract('vault');
        return await vault.balanceOf(account);
    }
    
    /**
     * Get fund details
     */
    async getFundDetails(fundId: string): Promise<any> {
        const factory = this.getContract('factory');
        return await factory.funds(fundId);
    }
    
    /**
     * Find optimal swap route
     */
    async findOptimalRoute(
        tokenIn: string,
        tokenOut: string,
        amountIn: bigint
    ): Promise<{ bestDEX: number; expectedOut: bigint }> {
        const aggregator = this.getContract('aggregator');
        return await aggregator.findOptimalRoute(tokenIn, tokenOut, amountIn);
    }
    
    /**
     * Format ether value for display
     */
    formatEther(value: bigint, decimals: number = 4): string {
        const formatted = ethers.formatEther(value);
        const parts = formatted.split('.');
        if (parts.length === 2 && parts[1].length > decimals) {
            return `${parts[0]}.${parts[1].substring(0, decimals)}`;
        }
        return formatted;
    }
    
    /**
     * Parse ether value from string
     */
    parseEther(value: string): bigint {
        return ethers.parseEther(value);
    }
    
    /**
     * Handle account changes
     */
    private handleAccountsChanged(accounts: string[]): void {
        if (accounts.length === 0) {
            // User disconnected wallet
            this.signer = null;
            this.contracts.clear();
        } else {
            // Account changed, reinitialize signer
            this.initializeSigner();
        }
    }
    
    /**
     * Initialize signer
     */
    private async initializeSigner(): Promise<void> {
        if (this.provider) {
            this.signer = await this.provider.getSigner();
            this.contracts.clear(); // Clear cached contracts
        }
    }
    
    /**
     * Wait for transaction confirmation
     */
    async waitForTransaction(
        tx: ethers.ContractTransactionResponse,
        confirmations: number = 1
    ): Promise<ethers.ContractTransactionReceipt | null> {
        console.log(`Waiting for transaction: ${tx.hash}`);
        return await tx.wait(confirmations);
    }
    
    /**
     * Estimate gas for transaction
     */
    async estimateGas(
        contract: string,
        method: string,
        args: any[]
    ): Promise<bigint> {
        const contractInstance = this.getContract(contract);
        return await contractInstance[method].estimateGas(...args);
    }
    
    /**
     * Get current gas price
     */
    async getGasPrice(): Promise<bigint> {
        if (!this.provider) {
            throw new Error('No provider available');
        }
        const feeData = await this.provider.getFeeData();
        return feeData.gasPrice || BigInt(0);
    }
    
    /**
     * Check if address is valid
     */
    isValidAddress(address: string): boolean {
        return ethers.isAddress(address);
    }
    
    /**
     * Get block number
     */
    async getBlockNumber(): Promise<number> {
        if (!this.provider) {
            throw new Error('No provider available');
        }
        return await this.provider.getBlockNumber();
    }
    
    /**
     * Subscribe to events
     */
    subscribeToEvent(
        contract: string,
        eventName: string,
        callback: (args: any) => void
    ): void {
        const contractInstance = this.getContract(contract);
        contractInstance.on(eventName, callback);
    }
    
    /**
     * Unsubscribe from events
     */
    unsubscribeFromEvent(
        contract: string,
        eventName: string,
        callback?: (args: any) => void
    ): void {
        const contractInstance = this.getContract(contract);
        if (callback) {
            contractInstance.off(eventName, callback);
        } else {
            contractInstance.removeAllListeners(eventName);
        }
    }
}

// Export singleton instance
export const web3Manager = new Web3Manager();
