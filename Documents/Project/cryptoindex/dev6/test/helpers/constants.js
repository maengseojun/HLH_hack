const { ethers } = require("hardhat");

// Common constants used across tests
const CONSTANTS = {
    // Time constants
    ONE_DAY: 24 * 60 * 60,
    ONE_WEEK: 7 * 24 * 60 * 60,
    ONE_MONTH: 30 * 24 * 60 * 60,
    
    // Token amounts
    INITIAL_SUPPLY: ethers.parseEther("1000000"),
    LARGE_AMOUNT: ethers.parseEther("100000"),
    MEDIUM_AMOUNT: ethers.parseEther("1000"),
    SMALL_AMOUNT: ethers.parseEther("100"),
    TINY_AMOUNT: ethers.parseEther("1"),
    
    // Percentages (in basis points)
    ONE_HUNDRED_PERCENT: 10000,
    FIFTY_PERCENT: 5000,
    TEN_PERCENT: 1000,
    ONE_PERCENT: 100,
    
    // Gas limits
    DEFAULT_GAS_LIMIT: 3000000,
    HIGH_GAS_LIMIT: 8000000,
    
    // Role hashes
    DEFAULT_ADMIN_ROLE: ethers.ZeroHash,
    MINTER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE")),
    PAUSER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE")),
    MANAGER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE")),
    UPGRADER_ROLE: ethers.keccak256(ethers.toUtf8Bytes("UPGRADER_ROLE")),
    
    // Error messages
    ERRORS: {
        NOT_OWNER: "Ownable: caller is not the owner",
        PAUSED: "Pausable: paused",
        NOT_PAUSED: "Pausable: not paused",
        ZERO_ADDRESS: "Invalid component address",
        INSUFFICIENT_BALANCE: "ERC20: transfer amount exceeds balance",
        INSUFFICIENT_ALLOWANCE: "ERC20: insufficient allowance",
        INVALID_WEIGHTS: "Invalid weights",
        ONLY_FACTORY: "Only factory can call",
        ACCESS_DENIED: "AccessControl:",
    },
    
    // Test addresses
    TEST_ADDRESSES: {
        ZERO: ethers.ZeroAddress,
        DEAD: "0x000000000000000000000000000000000000dEaD",
        RANDOM: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9",
    },
    
    // Chain IDs
    CHAIN_IDS: {
        HARDHAT: 31337,
        ETHEREUM_SEPOLIA: 11155111,
        ARBITRUM_SEPOLIA: 421614,
        POLYGON_AMOY: 80002,
        HYPEREVM_TESTNET: 998,
    },
    
    // LayerZero Endpoint IDs
    LZ_ENDPOINTS: {
        ETHEREUM_SEPOLIA: 40161,
        ARBITRUM_SEPOLIA: 40231,
        POLYGON_AMOY: 40109,
        HYPEREVM_TESTNET: 30999,
    }
};

module.exports = CONSTANTS;
