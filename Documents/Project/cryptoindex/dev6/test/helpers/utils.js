const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * Utility functions for testing
 */
const utils = {
    /**
     * Deploy a mock ERC20 token
     */
    async deployMockToken(name, symbol, initialSupply) {
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const token = await MockERC20.deploy(name, symbol, initialSupply);
        return token;
    },
    
    /**
     * Deploy multiple mock tokens
     */
    async deployMockTokens(count, initialSupply = ethers.parseEther("1000000")) {
        const tokens = [];
        for (let i = 0; i < count; i++) {
            const token = await this.deployMockToken(
                `Token ${String.fromCharCode(65 + i)}`,
                `TK${String.fromCharCode(65 + i)}`,
                initialSupply
            );
            tokens.push(token);
        }
        return tokens;
    },
    
    /**
     * Get current block timestamp
     */
    async getCurrentTimestamp() {
        const block = await ethers.provider.getBlock("latest");
        return block.timestamp;
    },
    
    /**
     * Increase time and mine block
     */
    async increaseTime(seconds) {
        await time.increase(seconds);
        await ethers.provider.send("evm_mine");
    },
    
    /**
     * Set next block timestamp
     */
    async setNextBlockTimestamp(timestamp) {
        await time.setNextBlockTimestamp(timestamp);
    },
    
    /**
     * Calculate expected shares for deposit
     */
    calculateShares(depositAmount, totalAssets, totalShares) {
        if (totalShares === 0n || totalAssets === 0n) {
            return depositAmount;
        }
        return (depositAmount * totalShares) / totalAssets;
    },
    
    /**
     * Calculate expected assets for shares
     */
    calculateAssets(shares, totalAssets, totalShares) {
        if (totalShares === 0n) {
            return 0n;
        }
        return (shares * totalAssets) / totalShares;
    },
    
    /**
     * Generate random address
     */
    generateRandomAddress() {
        const wallet = ethers.Wallet.createRandom();
        return wallet.address;
    },
    
    /**
     * Generate multiple random addresses
     */
    generateRandomAddresses(count) {
        const addresses = [];
        for (let i = 0; i < count; i++) {
            addresses.push(this.generateRandomAddress());
        }
        return addresses;
    },
    
    /**
     * Calculate gas used from transaction receipt
     */
    async getGasUsed(tx) {
        const receipt = await tx.wait();
        return receipt.gasUsed;
    },
    
    /**
     * Calculate gas cost in ETH
     */
    async getGasCost(tx) {
        const receipt = await tx.wait();
        const gasUsed = receipt.gasUsed;
        const gasPrice = tx.gasPrice || receipt.effectiveGasPrice;
        return gasUsed * gasPrice;
    },
    
    /**
     * Approve tokens for spending
     */
    async approveTokens(tokens, spender, amounts, signer) {
        const approvals = [];
        for (let i = 0; i < tokens.length; i++) {
            const tx = await tokens[i].connect(signer).approve(spender, amounts[i]);
            approvals.push(tx);
        }
        return Promise.all(approvals.map(tx => tx.wait()));
    },
    
    /**
     * Transfer tokens to multiple addresses
     */
    async distributeTokens(token, recipients, amounts, signer) {
        const transfers = [];
        for (let i = 0; i < recipients.length; i++) {
            const tx = await token.connect(signer).transfer(recipients[i], amounts[i]);
            transfers.push(tx);
        }
        return Promise.all(transfers.map(tx => tx.wait()));
    },
    
    /**
     * Get balance of multiple tokens for an address
     */
    async getTokenBalances(tokens, address) {
        const balances = [];
        for (const token of tokens) {
            const balance = await token.balanceOf(address);
            balances.push(balance);
        }
        return balances;
    },
    
    /**
     * Create a snapshot and return revert function
     */
    async createSnapshot() {
        const snapshotId = await ethers.provider.send("evm_snapshot");
        return async () => {
            await ethers.provider.send("evm_revert", [snapshotId]);
        };
    },
    
    /**
     * Mine multiple blocks
     */
    async mineBlocks(count) {
        for (let i = 0; i < count; i++) {
            await ethers.provider.send("evm_mine");
        }
    },
    
    /**
     * Get event from transaction receipt
     */
    async getEvent(tx, eventName) {
        const receipt = await tx.wait();
        const event = receipt.logs.find(log => {
            try {
                const parsed = tx.interface.parseLog(log);
                return parsed.name === eventName;
            } catch {
                return false;
            }
        });
        return event ? tx.interface.parseLog(event) : null;
    },
    
    /**
     * Calculate percentage
     */
    calculatePercentage(value, percentage) {
        return (value * BigInt(percentage)) / 10000n;
    },
    
    /**
     * Compare with tolerance
     */
    isWithinTolerance(actual, expected, toleranceBps = 10) {
        const diff = actual > expected ? actual - expected : expected - actual;
        const tolerance = (expected * BigInt(toleranceBps)) / 10000n;
        return diff <= tolerance;
    },
    
    /**
     * Format ether for display
     */
    formatEther(value) {
        return ethers.formatEther(value);
    },
    
    /**
     * Parse ether from string
     */
    parseEther(value) {
        return ethers.parseEther(value);
    },
    
    /**
     * Get signer by index
     */
    async getSigner(index) {
        const signers = await ethers.getSigners();
        return signers[index];
    },
    
    /**
     * Deploy contract with proxy
     */
    async deployProxy(contractName, args = []) {
        const Contract = await ethers.getContractFactory(contractName);
        const contract = await upgrades.deployProxy(Contract, args);
        await contract.deployed();
        return contract;
    },
    
    /**
     * Upgrade proxy contract
     */
    async upgradeProxy(proxyAddress, newContractName) {
        const NewContract = await ethers.getContractFactory(newContractName);
        const upgraded = await upgrades.upgradeProxy(proxyAddress, NewContract);
        return upgraded;
    }
};

module.exports = utils;
