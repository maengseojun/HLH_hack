/**
 * HyperIndex System Integration Tests
 * 로컬에서 실행할 수 있는 종합 테스트 스위트
 */

const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time, loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

describe('HyperIndex System Integration Tests', function () {
  // 테스트 설정
  async function deploySystemFixture() {
    const [owner, user1, user2, user3, maliciousUser] = await ethers.getSigners();
    
    // Mock contracts
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const MockPriceFeed = await ethers.getContractFactory('MockPriceFeed');
    const MockLayerZeroEndpoint = await ethers.getContractFactory('MockLayerZeroEndpoint');
    
    // Core contracts
    const IndexTokenFactory = await ethers.getContractFactory('IndexTokenFactory');
    const SmartIndexVault = await ethers.getContractFactory('SmartIndexVault');
    const HyperIndexVaultFactory = await ethers.getContractFactory('HyperIndexVaultFactory');
    const RebalancingEngine = await ethers.getContractFactory('RebalancingEngine');
    const SecurityManager = await ethers.getContractFactory('SecurityManager');
    const LayerZeroMessaging = await ethers.getContractFactory('LayerZeroMessaging');
    const CrossChainVaultManager = await ethers.getContractFactory('CrossChainVaultManager');
    
    // Deploy mock contracts
    const usdc = await MockERC20.deploy('USDC', 'USDC', 6);
    const weth = await MockERC20.deploy('WETH', 'WETH', 18);
    const wbtc = await MockERC20.deploy('WBTC', 'WBTC', 8);
    
    const priceFeed = await MockPriceFeed.deploy();
    const lzEndpoint = await MockLayerZeroEndpoint.deploy();
    
    // Deploy core system
    const indexTokenFactory = await IndexTokenFactory.deploy();
    
    // Deploy vault implementation
    const vaultImplementation = await SmartIndexVault.deploy(
      usdc.address,
      'Vault Template',
      'VAULT'
    );
    
    const hyperIndexVaultFactory = await HyperIndexVaultFactory.deploy(
      vaultImplementation.address,
      indexTokenFactory.address,
      priceFeed.address
    );
    
    const layerZeroMessaging = await LayerZeroMessaging.deploy(lzEndpoint.address);
    
    const crossChainManager = await CrossChainVaultManager.deploy(
      layerZeroMessaging.address
    );
    
    const rebalancingEngine = await RebalancingEngine.deploy(
      ethers.constants.AddressZero, // Mock aggregator
      priceFeed.address,
      crossChainManager.address
    );
    
    const securityManager = await SecurityManager.deploy(priceFeed.address);
    
    // Setup initial token balances
    const initialBalance = ethers.utils.parseEther('1000000');
    await usdc.mint(user1.address, initialBalance);
    await weth.mint(user1.address, initialBalance);
    await wbtc.mint(user1.address, initialBalance);
    
    await usdc.mint(user2.address, initialBalance);
    await weth.mint(user2.address, initialBalance);
    await wbtc.mint(user2.address, initialBalance);
    
    // Setup prices
    await priceFeed.setPrice(0, ethers.utils.parseEther('1')); // USDC
    await priceFeed.setPrice(1, ethers.utils.parseEther('2000')); // WETH
    await priceFeed.setPrice(2, ethers.utils.parseEther('30000')); // WBTC
    
    return {
      owner,
      user1,
      user2,
      user3,
      maliciousUser,
      usdc,
      weth,
      wbtc,
      priceFeed,
      lzEndpoint,
      indexTokenFactory,
      vaultImplementation,
      hyperIndexVaultFactory,
      layerZeroMessaging,
      crossChainManager,
      rebalancingEngine,
      securityManager
    };
  }

  describe('1. 기본 시스템 배포 및 초기화 테스트', function () {
    it('모든 컨트랙트가 정상적으로 배포되어야 함', async function () {
      const { 
        indexTokenFactory, 
        hyperIndexVaultFactory, 
        rebalancingEngine, 
        securityManager 
      } = await loadFixture(deploySystemFixture);
      
      expect(await indexTokenFactory.address).to.not.equal(ethers.constants.AddressZero);
      expect(await hyperIndexVaultFactory.address).to.not.equal(ethers.constants.AddressZero);
      expect(await rebalancingEngine.address).to.not.equal(ethers.constants.AddressZero);
      expect(await securityManager.address).to.not.equal(ethers.constants.AddressZero);
    });

    it('권한이 올바르게 설정되어야 함', async function () {
      const { owner, securityManager } = await loadFixture(deploySystemFixture);
      
      const DEFAULT_ADMIN_ROLE = await securityManager.DEFAULT_ADMIN_ROLE();
      expect(await securityManager.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });
  });

  describe('2. HyperIndex 제품 생성 테스트', function () {
    it('올바른 파라미터로 제품을 생성할 수 있어야 함', async function () {
      const { 
        owner, 
        usdc, 
        weth, 
        wbtc, 
        hyperIndexVaultFactory, 
        indexTokenFactory 
      } = await loadFixture(deploySystemFixture);
      
      // Authorize tokens
      await indexTokenFactory.authorizeToken(usdc.address, 0, true);
      await indexTokenFactory.authorizeToken(weth.address, 1, true);
      await indexTokenFactory.authorizeToken(wbtc.address, 2, true);
      
      const components = [
        {
          tokenAddress: usdc.address,
          hyperliquidAssetIndex: 0,
          targetRatio: 4000, // 40%
          depositedAmount: 0
        },
        {
          tokenAddress: weth.address,
          hyperliquidAssetIndex: 1,
          targetRatio: 4000, // 40%
          depositedAmount: 0
        },
        {
          tokenAddress: wbtc.address,
          hyperliquidAssetIndex: 2,
          targetRatio: 2000, // 20%
          depositedAmount: 0
        }
      ];
      
      const vaultConfig = {
        managementFee: 200, // 2%
        performanceFee: 1000, // 10%
        maxTotalAssets: ethers.utils.parseEther('10000000'), // 10M
        publicAccess: true,
        authorizedUsers: []
      };
      
      const tx = await hyperIndexVaultFactory.createHyperIndexProduct(
        'Crypto Top 3 Index',
        'CTI3',
        components,
        vaultConfig
      );
      
      const receipt = await tx.wait();
      const event = receipt.events.find(e => e.event === 'HyperIndexProductCreated');
      
      expect(event).to.not.be.undefined;
      expect(event.args.name).to.equal('Crypto Top 3 Index');
      expect(event.args.symbol).to.equal('CTI3');
    });

    it('잘못된 파라미터로 제품 생성이 실패해야 함', async function () {
      const { hyperIndexVaultFactory } = await loadFixture(deploySystemFixture);
      
      // Empty name should fail
      await expect(
        hyperIndexVaultFactory.createHyperIndexProduct('', 'CTI3', [], {
          managementFee: 200,
          performanceFee: 1000,
          maxTotalAssets: ethers.utils.parseEther('10000000'),
          publicAccess: true,
          authorizedUsers: []
        })
      ).to.be.revertedWith('Name required');
      
      // Too many components should fail
      const tooManyComponents = new Array(15).fill({
        tokenAddress: ethers.constants.AddressZero,
        hyperliquidAssetIndex: 0,
        targetRatio: 1000,
        depositedAmount: 0
      });
      
      await expect(
        hyperIndexVaultFactory.createHyperIndexProduct(
          'Test Index',
          'TEST',
          tooManyComponents,
          {
            managementFee: 200,
            performanceFee: 1000,
            maxTotalAssets: ethers.utils.parseEther('10000000'),
            publicAccess: true,
            authorizedUsers: []
          }
        )
      ).to.be.revertedWith('Invalid component count');
    });
  });

  describe('3. 보안 시스템 테스트', function () {
    it('대용량 거래가 차단되어야 함', async function () {
      const { user1, maliciousUser, securityManager } = await loadFixture(deploySystemFixture);
      
      // Grant monitor role for testing
      const MONITOR_ROLE = await securityManager.MONITOR_ROLE();
      await securityManager.grantRole(MONITOR_ROLE, user1.address);
      
      const largeAmount = ethers.utils.parseEther('2000000'); // 2M tokens (exceeds limit)
      
      const [allowed, reason] = await securityManager.connect(user1).preTransactionCheck(
        maliciousUser.address,
        ethers.constants.AddressZero,
        largeAmount,
        'test'
      );
      
      expect(allowed).to.be.false;
      expect(reason).to.equal('Circuit breaker triggered');
    });

    it('블랙리스트된 주소가 차단되어야 함', async function () {
      const { user1, maliciousUser, securityManager } = await loadFixture(deploySystemFixture);
      
      // Blacklist malicious user
      await securityManager.blacklistAddress(maliciousUser.address, 'Test blacklist');
      
      const MONITOR_ROLE = await securityManager.MONITOR_ROLE();
      await securityManager.grantRole(MONITOR_ROLE, user1.address);
      
      const [allowed, reason] = await securityManager.connect(user1).preTransactionCheck(
        maliciousUser.address,
        ethers.constants.AddressZero,
        ethers.utils.parseEther('100'),
        'test'
      );
      
      expect(allowed).to.be.false;
      expect(reason).to.equal('Address blacklisted');
    });

    it('비상 모드가 모든 거래를 차단해야 함', async function () {
      const { user1, user2, securityManager } = await loadFixture(deploySystemFixture);
      
      // Activate emergency mode
      await securityManager.emergencyStop('Test emergency');
      
      const MONITOR_ROLE = await securityManager.MONITOR_ROLE();
      await securityManager.grantRole(MONITOR_ROLE, user1.address);
      
      const [allowed, reason] = await securityManager.connect(user1).preTransactionCheck(
        user2.address,
        ethers.constants.AddressZero,
        ethers.utils.parseEther('100'),
        'test'
      );
      
      expect(allowed).to.be.false;
      expect(reason).to.equal('System in emergency mode');
    });
  });

  describe('4. 리밸런싱 엔진 테스트', function () {
    it('리밸런싱 전략을 설정할 수 있어야 함', async function () {
      const { owner, rebalancingEngine } = await loadFixture(deploySystemFixture);
      
      const fundId = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test-fund'));
      const GOVERNANCE_ROLE = await rebalancingEngine.GOVERNANCE_ROLE();
      
      await rebalancingEngine.setVaultStrategy(
        fundId,
        1, // AGGRESSIVE strategy
        150, // 1.5% custom tolerance
        true, // cross-chain enabled
        [1, 137, 42161] // Ethereum, Polygon, Arbitrum
      );
      
      // This would require implementing the getter function in the contract
      // const strategy = await rebalancingEngine.getVaultStrategy(fundId);
      // expect(strategy.strategy).to.equal(1);
    });

    it('비상 리밸런싱이 높은 편차에서 트리거되어야 함', async function () {
      const { rebalancingEngine } = await loadFixture(deploySystemFixture);
      
      // This test would require a mock vault with extreme deviation
      // Implementation depends on having a proper vault setup
    });
  });

  describe('5. 극한 상황 테스트', function () {
    it('플래시론 공격 시뮬레이션', async function () {
      const { user1, maliciousUser, securityManager } = await loadFixture(deploySystemFixture);
      
      const MONITOR_ROLE = await securityManager.MONITOR_ROLE();
      await securityManager.grantRole(MONITOR_ROLE, user1.address);
      
      const largeAmount = ethers.utils.parseEther('1000000');
      const profitAmount = ethers.utils.parseEther('1050000'); // 5% profit
      
      await securityManager.connect(user1).detectFlashloanAttack(
        maliciousUser.address,
        largeAmount,
        profitAmount,
        0 // Same block
      );
      
      // Should be blacklisted after flashloan attack detection
      expect(await securityManager.isBlacklisted(maliciousUser.address)).to.be.true;
    });

    it('가격 조작 감지', async function () {
      const { user1, weth, securityManager, priceFeed } = await loadFixture(deploySystemFixture);
      
      const MONITOR_ROLE = await securityManager.MONITOR_ROLE();
      await securityManager.grantRole(MONITOR_ROLE, user1.address);
      
      // Set initial price
      const initialPrice = ethers.utils.parseEther('2000');
      await securityManager.connect(user1).monitorPriceMovement(weth.address, initialPrice);
      
      // Simulate extreme price movement (50% increase)
      const manipulatedPrice = ethers.utils.parseEther('3000');
      await securityManager.connect(user1).monitorPriceMovement(weth.address, manipulatedPrice);
      
      // Check that security event was triggered
      const securityEvent = await securityManager.getSecurityEvent(1);
      expect(securityEvent.eventType).to.equal(2); // PRICE_MANIPULATION
    });

    it('대량 거래량 처리 테스트', async function () {
      const { user1, user2, securityManager } = await loadFixture(deploySystemFixture);
      
      const MONITOR_ROLE = await securityManager.MONITOR_ROLE();
      await securityManager.grantRole(MONITOR_ROLE, user1.address);
      
      // Simulate multiple large transactions
      for (let i = 0; i < 10; i++) {
        const amount = ethers.utils.parseEther('50000'); // 50K each
        
        const [allowed] = await securityManager.connect(user1).preTransactionCheck(
          user2.address,
          ethers.constants.AddressZero,
          amount,
          'bulk_test'
        );
        
        if (allowed) {
          await securityManager.connect(user1).postTransactionMonitor(
            user2.address,
            ethers.constants.AddressZero,
            amount,
            true
          );
        }
      }
      
      // After 10 transactions, user should hit limits
      const [allowed] = await securityManager.connect(user1).preTransactionCheck(
        user2.address,
        ethers.constants.AddressZero,
        ethers.utils.parseEther('50000'),
        'bulk_test'
      );
      
      expect(allowed).to.be.false;
    });
  });

  describe('6. 성능 및 가스 효율성 테스트', function () {
    it('대량 컴포넌트 처리 성능', async function () {
      const { 
        owner, 
        usdc, 
        weth, 
        wbtc, 
        hyperIndexVaultFactory, 
        indexTokenFactory 
      } = await loadFixture(deploySystemFixture);
      
      // Authorize tokens
      await indexTokenFactory.authorizeToken(usdc.address, 0, true);
      await indexTokenFactory.authorizeToken(weth.address, 1, true);
      await indexTokenFactory.authorizeToken(wbtc.address, 2, true);
      
      const maxComponents = [
        { tokenAddress: usdc.address, hyperliquidAssetIndex: 0, targetRatio: 1000, depositedAmount: 0 },
        { tokenAddress: weth.address, hyperliquidAssetIndex: 1, targetRatio: 1000, depositedAmount: 0 },
        { tokenAddress: wbtc.address, hyperliquidAssetIndex: 2, targetRatio: 1000, depositedAmount: 0 },
        { tokenAddress: usdc.address, hyperliquidAssetIndex: 3, targetRatio: 1000, depositedAmount: 0 },
        { tokenAddress: weth.address, hyperliquidAssetIndex: 4, targetRatio: 1000, depositedAmount: 0 },
        { tokenAddress: wbtc.address, hyperliquidAssetIndex: 5, targetRatio: 1000, depositedAmount: 0 },
        { tokenAddress: usdc.address, hyperliquidAssetIndex: 6, targetRatio: 1000, depositedAmount: 0 },
        { tokenAddress: weth.address, hyperliquidAssetIndex: 7, targetRatio: 1000, depositedAmount: 0 },
        { tokenAddress: wbtc.address, hyperliquidAssetIndex: 8, targetRatio: 1000, depositedAmount: 0 },
        { tokenAddress: usdc.address, hyperliquidAssetIndex: 9, targetRatio: 1000, depositedAmount: 0 }
      ];
      
      const vaultConfig = {
        managementFee: 200,
        performanceFee: 1000,
        maxTotalAssets: ethers.utils.parseEther('10000000'),
        publicAccess: true,
        authorizedUsers: []
      };
      
      const tx = await hyperIndexVaultFactory.createHyperIndexProduct(
        'Max Components Index',
        'MCI',
        maxComponents,
        vaultConfig
      );
      
      const receipt = await tx.wait();
      
      // Check gas usage
      console.log(`Gas used for max components: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed.lt(ethers.utils.parseUnits('5000000', 'wei'))).to.be.true; // Should be under 5M gas
    });

    it('보안 체크 성능 측정', async function () {
      const { user1, user2, securityManager } = await loadFixture(deploySystemFixture);
      
      const MONITOR_ROLE = await securityManager.MONITOR_ROLE();
      await securityManager.grantRole(MONITOR_ROLE, user1.address);
      
      const startTime = Date.now();
      
      // Run 100 security checks
      for (let i = 0; i < 100; i++) {
        await securityManager.connect(user1).preTransactionCheck(
          user2.address,
          ethers.constants.AddressZero,
          ethers.utils.parseEther('1000'),
          'performance_test'
        );
      }
      
      const endTime = Date.now();
      const averageTime = (endTime - startTime) / 100;
      
      console.log(`Average security check time: ${averageTime}ms`);
      expect(averageTime).to.be.lessThan(100); // Should be under 100ms per check
    });
  });

  describe('7. 비즈니스 로직 검증', function () {
    it('수수료 계산이 정확해야 함', async function () {
      // Implementation depends on vault deployment and deposit/withdrawal testing
      // This would test management and performance fee calculations
    });

    it('크로스체인 메시지 처리가 올바르게 작동해야 함', async function () {
      const { layerZeroMessaging, lzEndpoint } = await loadFixture(deploySystemFixture);
      
      // This would require implementing a full cross-chain message test
      // Including LayerZero endpoint simulation
    });

    it('리밸런싱 로직이 정확한 비율을 유지해야 함', async function () {
      // This would test the rebalancing calculations and ensure
      // that the target ratios are maintained within tolerance
    });
  });

  describe('8. 에지 케이스 및 예외 상황', function () {
    it('0 금액 거래 처리', async function () {
      const { user1, user2, securityManager } = await loadFixture(deploySystemFixture);
      
      const MONITOR_ROLE = await securityManager.MONITOR_ROLE();
      await securityManager.grantRole(MONITOR_ROLE, user1.address);
      
      const [allowed, reason] = await securityManager.connect(user1).preTransactionCheck(
        user2.address,
        ethers.constants.AddressZero,
        0,
        'zero_amount_test'
      );
      
      expect(allowed).to.be.true; // Zero amounts should be allowed
    });

    it('컨트랙트 주소 0 체크', async function () {
      const { hyperIndexVaultFactory } = await loadFixture(deploySystemFixture);
      
      const components = [
        {
          tokenAddress: ethers.constants.AddressZero,
          hyperliquidAssetIndex: 0,
          targetRatio: 10000,
          depositedAmount: 0
        }
      ];
      
      await expect(
        hyperIndexVaultFactory.createHyperIndexProduct(
          'Invalid Index',
          'INV',
          components,
          {
            managementFee: 200,
            performanceFee: 1000,
            maxTotalAssets: ethers.utils.parseEther('10000000'),
            publicAccess: true,
            authorizedUsers: []
          }
        )
      ).to.be.revertedWith('Invalid token address');
    });

    it('정수 오버플로우 방지', async function () {
      const { user1, securityManager } = await loadFixture(deploySystemFixture);
      
      const MONITOR_ROLE = await securityManager.MONITOR_ROLE();
      await securityManager.grantRole(MONITOR_ROLE, user1.address);
      
      const maxUint256 = ethers.constants.MaxUint256;
      
      const [allowed] = await securityManager.connect(user1).preTransactionCheck(
        user1.address,
        ethers.constants.AddressZero,
        maxUint256,
        'overflow_test'
      );
      
      expect(allowed).to.be.false; // Should be blocked by circuit breakers
    });
  });
});

// Mock contract implementations would go here
// These are simplified examples - full implementations would be needed for actual testing

describe('Mock Contracts for Testing', function () {
  // Mock ERC20 implementation
  it('MockERC20 should mint tokens correctly', async function () {
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const token = await MockERC20.deploy('Test Token', 'TEST', 18);
    
    const [owner, user1] = await ethers.getSigners();
    const amount = ethers.utils.parseEther('1000');
    
    await token.mint(user1.address, amount);
    expect(await token.balanceOf(user1.address)).to.equal(amount);
  });
});