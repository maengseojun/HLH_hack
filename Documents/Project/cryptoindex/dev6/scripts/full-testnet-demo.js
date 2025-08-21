const { ethers } = require('hardhat');

/**
 * 🧪 HyperEVM 테스트넷 완전 데모 스크립트
 * 이 스크립트는 Factory부터 Vault 생성, 입금, 리밸런싱, 출금까지 전체 워크플로우를 테스트합니다.
 */

async function fullTestnetDemo() {
    console.log('🚀 HyperEVM 테스트넷 완전 데모 시작...\n');
    
    const [deployer, user1, user2] = await ethers.getSigners();
    const currentNetwork = await ethers.provider.getNetwork();
    
    console.log('📋 네트워크 정보:');
    console.log(`  Network: ${currentNetwork.name}`);
    console.log(`  Chain ID: ${currentNetwork.chainId}`);
    console.log(`  Deployer: ${deployer.address}`);
    console.log(`  Deployer Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);
    
    const deployments = {};
    
    try {
        // 1️⃣ 핵심 컨트랙트 배포
        console.log('1️⃣ 핵심 컨트랙트 배포 시작...\n');
        
        // Mock ERC20 토큰들 배포
        console.log('📦 테스트 토큰 배포 중...');
        const MockERC20 = await ethers.getContractFactory('MockERC20');
        
        const tokens = {};
        const tokenData = [
            { name: 'Test USDC', symbol: 'TUSDC', decimals: 6 },
            { name: 'Test ETH', symbol: 'TETH', decimals: 18 },
            { name: 'Test BTC', symbol: 'TBTC', decimals: 8 },
            { name: 'Test SOL', symbol: 'TSOL', decimals: 9 }
        ];
        
        for (const token of tokenData) {
            const supply = ethers.parseUnits('1000000', token.decimals);
            const contract = await MockERC20.deploy(token.name, token.symbol, token.decimals);
            await contract.waitForDeployment();
            const contractAddress = await contract.getAddress();
            tokens[token.symbol] = contractAddress;
            
            // Mint initial supply to deployer
            await contract.mint(deployer.address, supply);
            console.log(`  ✅ ${token.name} (${token.symbol}): ${contractAddress}`);
        }
        deployments.tokens = tokens;
        
        // 먼저 MultiChainAggregator (Mock) 배포 (Price Feed 역할)
        console.log('\n🔗 MockMultiChainAggregator 배포 중...');
        const MockMultiChainAggregator = await ethers.getContractFactory('MockMultiChainAggregator');
        const aggregator = await MockMultiChainAggregator.deploy();
        await aggregator.waitForDeployment();
        deployments.aggregator = await aggregator.getAddress();
        console.log(`  ✅ MockMultiChainAggregator: ${deployments.aggregator}`);

        // IndexTokenFactory 배포 (aggregator를 priceFeed로 사용)
        console.log('\n🏭 IndexTokenFactory 배포 중...');
        const IndexTokenFactory = await ethers.getContractFactory('IndexTokenFactory');
        const factory = await IndexTokenFactory.deploy(deployments.aggregator);
        await factory.waitForDeployment();
        deployments.factory = await factory.getAddress();
        console.log(`  ✅ IndexTokenFactory: ${deployments.factory}`);
        console.log(`  ✅ MockMultiChainAggregator: ${deployments.aggregator}`);
        
        // RedemptionManager 배포 (MockPriceFeed 필요)
        console.log('\n💱 MockPriceFeed 배포 중...');
        const MockPriceFeed = await ethers.getContractFactory('MockPriceFeed');
        const priceFeed = await MockPriceFeed.deploy();
        await priceFeed.waitForDeployment();
        deployments.priceFeed = await priceFeed.getAddress();
        console.log(`  ✅ MockPriceFeed: ${deployments.priceFeed}`);
        
        console.log('\n🔄 MockAMM 배포 중...');
        const MockAMM = await ethers.getContractFactory('MockAMM');
        const mockAMM = await MockAMM.deploy();
        await mockAMM.waitForDeployment();
        deployments.mockAMM = await mockAMM.getAddress();
        console.log(`  ✅ MockAMM: ${deployments.mockAMM}`);
        
        // ChainVault 배포를 위한 Mock ChainVault
        console.log('\n🏦 Mock ChainVault 배포 중...');
        const ChainVault = await ethers.getContractFactory('ChainVault');
        const chainVault = await ChainVault.deploy();
        await chainVault.waitForDeployment();
        deployments.chainVault = await chainVault.getAddress();
        console.log(`  ✅ ChainVault: ${deployments.chainVault}`);
        
        console.log('\n🔄 RedemptionManager 배포 중...');
        const RedemptionManager = await ethers.getContractFactory('RedemptionManager');
        const redemptionManager = await RedemptionManager.deploy(
            deployments.priceFeed,
            deployments.mockAMM,
            deployments.aggregator,
            deployments.factory,
            deployments.chainVault
        );
        await redemptionManager.waitForDeployment();
        deployments.redemptionManager = await redemptionManager.getAddress();
        console.log(`  ✅ RedemptionManager: ${deployments.redemptionManager}`);
        
        // 2️⃣ 인덱스 토큰 생성 테스트
        console.log('\n2️⃣ 인덱스 토큰 생성 테스트...\n');
        
        const fundName = "K-Crypto Top 4 Index";
        const fundSymbol = "KTOP4";
        const fundId = ethers.keccak256(ethers.toUtf8Bytes(`${fundName}_${Date.now()}`));
        
        // 컴포넌트 토큰 설정 (동일 가중)
        const componentTokens = [
            {
                tokenAddress: tokens.TETH,
                hyperliquidAssetIndex: 0,
                targetRatio: 2500, // 25%
                depositedAmount: 0
            },
            {
                tokenAddress: tokens.TBTC,
                hyperliquidAssetIndex: 1,
                targetRatio: 2500, // 25%
                depositedAmount: 0
            },
            {
                tokenAddress: tokens.TSOL,
                hyperliquidAssetIndex: 2,
                targetRatio: 2500, // 25%
                depositedAmount: 0
            },
            {
                tokenAddress: tokens.TUSDC,
                hyperliquidAssetIndex: 3,
                targetRatio: 2500, // 25%
                depositedAmount: 0
            }
        ];
        
        // 토큰 승인 (RECIPE_CREATOR_ROLE 필요)
        console.log('🔐 역할 및 토큰 승인 중...');
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, deployer.address);
        
        // user1에게 필요한 역할 부여
        const [, user1] = await ethers.getSigners();
        await factory.grantRole(RECIPE_CREATOR_ROLE, user1.address);
        const PLATFORM_ADMIN_ROLE = await factory.PLATFORM_ADMIN_ROLE();
        await factory.grantRole(PLATFORM_ADMIN_ROLE, user1.address);
        
        // 각 토큰을 승인된 토큰 목록에 추가
        for (const token of Object.values(tokens)) {
            const authTx = await factory.authorizeToken(token, true);
            await authTx.wait();
        }
        
        console.log('📊 인덱스 펀드 생성 중...');
        console.log(`  펀드명: ${fundName}`);
        console.log(`  심볼: ${fundSymbol}`);
        console.log(`  Fund ID: ${fundId}`);
        
        const createTx = await factory.createIndexFund(
            fundName,
            fundSymbol,
            componentTokens
        );
        await createTx.wait();
        
        const fundInfo = await factory.getFundInfo(fundId);
        console.log(`  ✅ 인덱스 토큰 주소: ${fundInfo[3]}`);
        deployments.indexToken = fundInfo[3];
        
        // 3️⃣ 토큰 발행 테스트
        console.log('\n3️⃣ 토큰 발행 테스트...\n');
        
        const issueAmount = ethers.parseEther('100'); // 100 인덱스 토큰 발행
        console.log(`💰 ${ethers.formatEther(issueAmount)} 토큰 발행 시도...`);
        
        // 사용자에게 component 토큰 전송
        const MockERC20Contract = await ethers.getContractFactory('MockERC20');
        for (const [symbol, address] of Object.entries(tokens)) {
            const tokenContract = MockERC20Contract.attach(address);
            const transferAmount = ethers.parseUnits('10000', symbol === 'TUSDC' ? 6 : symbol === 'TBTC' ? 8 : symbol === 'TSOL' ? 9 : 18);
            await tokenContract.transfer(user1.address, transferAmount);
            console.log(`  📤 ${symbol} ${ethers.formatUnits(transferAmount, symbol === 'TUSDC' ? 6 : symbol === 'TBTC' ? 8 : symbol === 'TSOL' ? 9 : 18)}개를 ${user1.address}에 전송`);
        }
        
        // 컴포넌트 토큰 approve
        console.log('\n🔓 컴포넌트 토큰 Approve 중...');
        for (const component of componentTokens) {
            const tokenContract = MockERC20Contract.attach(component.tokenAddress);
            const tokenSymbol = await tokenContract.symbol();
            const decimals = await tokenContract.decimals();
            const approveAmount = ethers.parseUnits('1000', Number(decimals));
            
            await tokenContract.connect(user1).approve(deployments.factory, approveAmount);
            console.log(`  ✅ ${tokenSymbol} Approved: ${ethers.formatUnits(approveAmount, Number(decimals))}`);
        }
        
        // 먼저 컴포넌트 토큰을 예치해야 함
        console.log('💱 컴포넌트 토큰 예치 중...');
        const componentAmounts = [
            ethers.parseEther("250"),  // TETH
            ethers.parseUnits("250", 8), // TBTC
            ethers.parseUnits("250", 9), // TSOL
            ethers.parseEther("250")   // TUSDC
        ];
        
        // deployer가 먼저 토큰을 approve해야 함
        for (const [tokenSymbol, tokenAddress] of Object.entries(tokens)) {
            const TokenContract = await ethers.getContractFactory('MockERC20');
            const tokenContract = TokenContract.attach(tokenAddress);
            await tokenContract.approve(deployments.factory, ethers.parseEther("1000"));
        }
        
        const depositTx = await factory.depositComponentTokens(
            fundId,
            Object.values(tokens),
            componentAmounts
        );
        await depositTx.wait();
        console.log('  ✅ 컴포넌트 토큰 예치 완료');

        // 토큰 발행
        const issueTx = await factory.connect(user1).issueIndexToken(fundId, issueAmount);
        await issueTx.wait();
        
        const IndexToken = await ethers.getContractFactory('IndexToken');
        const indexTokenContract = IndexToken.attach(deployments.indexToken);
        const userBalance = await indexTokenContract.balanceOf(user1.address);
        console.log(`  ✅ 발행 완료! 사용자 잔액: ${ethers.formatEther(userBalance)} ${fundSymbol}`);
        
        // 4️⃣ NAV 계산 테스트
        console.log('\n4️⃣ NAV 계산 테스트...\n');
        const nav = await indexTokenContract.getNavPerToken();
        console.log(`  📈 현재 NAV: ${ethers.formatEther(nav)} USDC per token`);
        
        const totalValue = await indexTokenContract.getTotalFundValue();
        console.log(`  💎 총 펀드 가치: ${ethers.formatEther(totalValue)} USDC`);
        
        // 5️⃣ 컴포넌트 정보 확인
        console.log('\n5️⃣ 펀드 컴포넌트 정보...\n');
        const components = await indexTokenContract.getComponents();
        console.log('📊 펀드 구성:');
        for (let i = 0; i < components.length; i++) {
            const tokenContract = MockERC20Contract.attach(components[i].tokenAddress);
            const symbol = await tokenContract.symbol();
            console.log(`  ${symbol}: Weight ${components[i].weight/100}%, Deposited: ${ethers.formatEther(components[i].depositedAmount)}`);
        }
        
        // 6️⃣ 상환 테스트
        console.log('\n6️⃣ 토큰 상환 테스트...\n');
        
        const redeemAmount = ethers.parseEther('10'); // 10 토큰 상환
        console.log(`🔄 ${ethers.formatEther(redeemAmount)} 토큰 상환 시도...`);
        
        // 상환 가능 여부 확인
        const eligible = await redemptionManager.isEligibleForRedemption(
            user1.address, 
            fundId, 
            redeemAmount, 
            0 // OPTIMAL strategy
        );
        console.log(`  ✅ 상환 가능: ${eligible.eligible}`);
        if (!eligible.eligible) {
            console.log(`  ❌ 상환 불가 사유: ${eligible.reason}`);
        } else {
            // 상환 요청
            await indexTokenContract.connect(user1).approve(deployments.redemptionManager, redeemAmount);
            
            const requestTx = await redemptionManager.connect(user1).requestRedemption(
                fundId,
                redeemAmount,
                0, // OPTIMAL strategy
                500, // 5% slippage
                0, // min return
                Math.floor(Date.now() / 1000) + 3600 // 1시간 후 만료
            );
            
            const receipt = await requestTx.wait();
            console.log(`  ✅ 상환 요청 완료! 가스 사용량: ${receipt.gasUsed.toString()}`);
        }
        
        // 7️⃣ 최종 상태 확인
        console.log('\n7️⃣ 최종 상태 확인...\n');
        const finalBalance = await indexTokenContract.balanceOf(user1.address);
        const finalTotalSupply = await indexTokenContract.totalSupply();
        
        console.log('📊 최종 상태:');
        console.log(`  사용자 잔액: ${ethers.formatEther(finalBalance)} ${fundSymbol}`);
        console.log(`  총 공급량: ${ethers.formatEther(finalTotalSupply)} ${fundSymbol}`);
        console.log(`  현재 NAV: ${ethers.formatEther(await indexTokenContract.getNavPerToken())} USDC`);
        
        // 배포 정보 저장
        console.log('\n📄 배포 요약:\n');
        console.table({
            'IndexTokenFactory': deployments.factory,
            'MultiChainAggregator': deployments.aggregator,
            'RedemptionManager': deployments.redemptionManager,
            'ChainVault': deployments.chainVault,
            'IndexToken': deployments.indexToken,
            'Test USDC': tokens.TUSDC,
            'Test ETH': tokens.TETH,
            'Test BTC': tokens.TBTC,
            'Test SOL': tokens.TSOL
        });
        
        console.log('🎉 HyperEVM 테스트넷 데모 완료!\n');
        
        return {
            deployments,
            fundId,
            fundName,
            fundSymbol,
            userBalance: finalBalance,
            totalSupply: finalTotalSupply
        };
        
    } catch (error) {
        console.error('❌ 데모 실행 중 오류 발생:', error.message);
        if (error.reason) {
            console.error('🔍 오류 상세:', error.reason);
        }
        throw error;
    }
}

// 메인 실행
async function main() {
    const result = await fullTestnetDemo();
    
    console.log('✅ 데모 성공적으로 완료!');
    console.log('🔗 다음 단계:');
    console.log('1. HyperEVM 테스트넷 토큰 확보');
    console.log('2. .env 파일에 실제 private key 설정');  
    console.log('3. npm run deploy:testnet 실행');
    console.log('4. LayerZero 크로스체인 메시징 테스트');
    
    return result;
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}

module.exports = {
    fullTestnetDemo,
    main
};