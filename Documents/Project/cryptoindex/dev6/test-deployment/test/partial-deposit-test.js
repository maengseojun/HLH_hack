// test/partial-deposit-test.js
/**
 * Partial Deposit Logic Test
 * Based on Balancer V2 and Yearn V3 patterns
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Partial Deposit System", function () {
  let factory, liquidityAnalyzer, priceFeed, securityManager;
  let usdc, weth, wbtc;
  let owner, user1, user2;
  let fundId;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    // Deploy contracts (simplified for testing)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("USDC", "USDC", 6);
    weth = await MockERC20.deploy("WETH", "WETH", 18);
    wbtc = await MockERC20.deploy("WBTC", "WBTC", 8);
    
    // Setup balances
    await usdc.mint(user1.address, ethers.parseUnits("10000", 6)); // 10k USDC
    await weth.mint(user1.address, ethers.parseUnits("5", 18));     // 5 WETH
    await wbtc.mint(user1.address, ethers.parseUnits("1", 8));      // 1 WBTC
    
    await usdc.mint(user2.address, ethers.parseUnits("5000", 6));   // 5k USDC
  });

  describe("Dynamic Minimum Calculation", function () {
    it("Should calculate minimum based on market conditions", async function () {
      // High liquidity scenario
      await liquidityAnalyzer.updateMarketConditions(
        ethers.parseUnits("100000000", 6), // 100M liquidity
        1000,  // 10% volatility
        7000   // 70% demand
      );
      
      const [minimum, tier] = await liquidityAnalyzer.calculateDynamicMinimum();
      expect(minimum).to.be.lt(ethers.parseUnits("100", 6)); // Should be less than $100
      expect(tier).to.equal("Ultra High");
    });
    
    it("Should increase minimum during high volatility", async function () {
      // High volatility scenario
      await liquidityAnalyzer.updateMarketConditions(
        ethers.parseUnits("10000000", 6), // 10M liquidity
        5000,  // 50% volatility
        3000   // 30% demand
      );
      
      const [minimum, tier] = await liquidityAnalyzer.calculateDynamicMinimum();
      expect(minimum).to.be.gt(ethers.parseUnits("300", 6)); // Should be higher due to volatility
      expect(tier).to.equal("High");
    });
  });

  describe("Partial Deposit Functionality", function () {
    beforeEach(async function () {
      // Create index with 3 components
      const components = [
        {
          tokenAddress: usdc.address,
          hyperliquidAssetIndex: 0,
          targetRatio: 4000, // 40% USDC
          depositedAmount: 0,
          currentRatio: 0
        },
        {
          tokenAddress: weth.address,
          hyperliquidAssetIndex: 1,
          targetRatio: 3500, // 35% WETH
          depositedAmount: 0,
          currentRatio: 0
        },
        {
          tokenAddress: wbtc.address,
          hyperliquidAssetIndex: 2,
          targetRatio: 2500, // 25% WBTC
          depositedAmount: 0,
          currentRatio: 0
        }
      ];
      
      fundId = await factory.createIndex(components, "Test Index", "TEST");
    });

    it("Should allow partial deposit with single token", async function () {
      // User deposits only USDC (not all components)
      const depositAmount = ethers.parseUnits("500", 6); // $500 USDC
      
      await usdc.connect(user1).approve(factory.address, depositAmount);
      await factory.connect(user1).depositToFund(fundId, usdc.address, depositAmount);
      
      // Check fund state
      const fundInfo = await factory.getFundInfo(fundId);
      expect(fundInfo.totalValue).to.be.gt(0);
      
      // Check component state
      const components = await factory.getFundComponents(fundId);
      expect(components[0].depositedAmount).to.equal(depositAmount);
      expect(components[1].depositedAmount).to.equal(0); // WETH not deposited
      expect(components[2].depositedAmount).to.equal(0); // WBTC not deposited
    });

    it("Should calculate correct ratios with partial deposits", async function () {
      // Deposit different amounts
      await usdc.connect(user1).approve(factory.address, ethers.parseUnits("400", 6));
      await factory.connect(user1).depositToFund(fundId, usdc.address, ethers.parseUnits("400", 6));
      
      await weth.connect(user1).approve(factory.address, ethers.parseUnits("0.5", 18));  
      await factory.connect(user1).depositToFund(fundId, weth.address, ethers.parseUnits("0.5", 18));
      
      const components = await factory.getFundComponents(fundId);
      const totalValue = await factory.calculateTotalFundValue(fundId);
      
      // Verify ratios are calculated correctly
      expect(components[0].currentRatio).to.be.gt(0); // USDC has some ratio
      expect(components[1].currentRatio).to.be.gt(0); // WETH has some ratio  
      expect(components[2].currentRatio).to.equal(0); // WBTC has no ratio
      
      console.log(`Total fund value: ${ethers.formatUnits(totalValue, 6)}`);
      console.log(`USDC ratio: ${components[0].currentRatio / 100}%`);
      console.log(`WETH ratio: ${components[1].currentRatio / 100}%`);
    });

    it("Should issue tokens when minimum is met with partial deposits", async function () {
      // Set low minimum for testing
      await liquidityAnalyzer.updateMarketConditions(
        ethers.parseUnits("100000000", 6), // High liquidity = low minimum
        500,   // Low volatility
        8000   // High demand
      );
      
      // Deposit enough to meet minimum (should be around $50-100)
      const depositAmount = ethers.parseUnits("150", 6); // $150 USDC
      await usdc.connect(user1).approve(factory.address, depositAmount);
      await factory.connect(user1).depositToFund(fundId, usdc.address, depositAmount);
      
      // Should be able to issue tokens with just USDC deposit
      const indexTokens = await factory.connect(user1).issueIndexTokens(fundId);
      
      const fundInfo = await factory.getFundInfo(fundId);
      expect(fundInfo.isIssued).to.be.true;
      expect(fundInfo.totalSupply).to.be.gt(0);
      
      console.log(`Index tokens issued: ${ethers.formatEther(indexTokens)}`);
    });
  });

  describe("Multi-User Scenarios", function () {
    it("Should handle multiple users with different deposit patterns", async function () {
      // User 1: Deposits USDC only
      await usdc.connect(user1).approve(factory.address, ethers.parseUnits("300", 6));
      await factory.connect(user1).depositToFund(fundId, usdc.address, ethers.parseUnits("300", 6));
      
      // User 2: Deposits different token
      await usdc.connect(user2).approve(factory.address, ethers.parseUnits("200", 6));
      await factory.connect(user2).depositToFund(fundId, usdc.address, ethers.parseUnits("200", 6));
      
      const totalValue = await factory.calculateTotalFundValue(fundId);
      expect(totalValue).to.equal(ethers.parseUnits("500", 6)); // $500 total
      
      // Both should be able to get proportional shares if minimum is met
      const user1Deposit = await factory.getUserDeposit(fundId, user1.address);
      const user2Deposit = await factory.getUserDeposit(fundId, user2.address);
      
      expect(user1Deposit).to.equal(ethers.parseUnits("300", 6));
      expect(user2Deposit).to.equal(ethers.parseUnits("200", 6));
    });
  });
});