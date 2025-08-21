const { ethers } = require("hardhat");

// Common fixtures for all tests
async function deployAccessControlFixture() {
    const [owner, admin, minter, pauser, manager, attacker, user1] = await ethers.getSigners();
    
    // Role definitions
    const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
    const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
    const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
    const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));
    
    // Deploy MockERC20 tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const tokenA = await MockERC20.deploy("Token A", "TKA", ethers.parseEther("1000000"));
    const tokenB = await MockERC20.deploy("Token B", "TKB", ethers.parseEther("1000000"));
    const tokenC = await MockERC20.deploy("Token C", "TKC", ethers.parseEther("1000000"));
    
    // Deploy MockPriceFeed
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = await MockPriceFeed.deploy();
    
    // Set initial prices
    await priceFeed.setPrice(tokenA.target, ethers.parseEther("100"));
    await priceFeed.setPrice(tokenB.target, ethers.parseEther("50"));
    await priceFeed.setPrice(tokenC.target, ethers.parseEther("1"));
    
    // Deploy IndexTokenFactory with price feed
    const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
    const factory = await IndexTokenFactory.deploy(priceFeed.target);
    
    return {
        factory,
        priceFeed,
        tokenA,
        tokenB,
        tokenC,
        owner,
        admin,
        minter,
        pauser,
        manager,
        attacker,
        user1,
        DEFAULT_ADMIN_ROLE,
        MINTER_ROLE,
        PAUSER_ROLE,
        MANAGER_ROLE
    };
}

async function deployVaultFixture() {
    const [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy underlying asset
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const asset = await MockERC20.deploy("USD Coin", "USDC", ethers.parseEther("1000000"));
    
    // Deploy SmartIndexVault
    const SmartIndexVault = await ethers.getContractFactory("SmartIndexVault");
    const vault = await SmartIndexVault.deploy(
        asset.target,
        "Vault Shares",
        "vShares"
    );
    
    // Distribute tokens
    await asset.transfer(user1.address, ethers.parseEther("10000"));
    await asset.transfer(user2.address, ethers.parseEther("10000"));
    
    return {
        vault,
        asset,
        owner,
        user1,
        user2
    };
}

async function deployAggregatorFixture() {
    const [owner, user1] = await ethers.getSigners();
    
    // Deploy Mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const tokenA = await MockERC20.deploy("Token A", "TKA", ethers.parseEther("1000000"));
    const tokenB = await MockERC20.deploy("Token B", "TKB", ethers.parseEther("1000000"));
    
    // Deploy MockPriceFeed
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = await MockPriceFeed.deploy();
    
    // Set prices
    await priceFeed.setPrice(tokenA.target, ethers.parseEther("100"));
    await priceFeed.setPrice(tokenB.target, ethers.parseEther("50"));
    
    // Deploy MultiDEXAggregator
    const MultiDEXAggregator = await ethers.getContractFactory("MultiDEXAggregator");
    const aggregator = await MultiDEXAggregator.deploy(priceFeed.target);
    
    // Transfer tokens to user
    await tokenA.transfer(user1.address, ethers.parseEther("1000"));
    await tokenB.transfer(user1.address, ethers.parseEther("1000"));
    
    return {
        aggregator,
        priceFeed,
        tokenA,
        tokenB,
        owner,
        user1
    };
}

module.exports = {
    deployAccessControlFixture,
    deployVaultFixture,
    deployAggregatorFixture
};
