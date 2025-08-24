const { ethers } = require("hardhat");

async function testInstitutionalIndex() {
    console.log("🏛️  기관 인덱스 생성 워크플로우 테스트 시작\n");
    
    const [deployer] = await ethers.getSigners();
    console.log("📋 계정 정보:");
    console.log(`   Deployer: ${deployer.address}`);
    console.log(`   Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);
    
    // 1. IndexTokenFactory 연결
    const factoryAddress = "0xC6E09548F406D7aC8fE8864b460eB07C0b9571D9";
    console.log("🏭 IndexTokenFactory 연결 중...");
    const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
    const factory = IndexTokenFactory.attach(factoryAddress);
    console.log(`   Factory Address: ${factoryAddress}`);
    
    // 2. 테스트용 Mock 토큰들 배포 (밈코인 대용)
    console.log("\n💰 테스트 토큰 배포 중...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    
    const tokenA = await MockERC20.deploy("Doge Coin", "DOGE", 18);
    await tokenA.waitForDeployment();
    const tokenAAddress = await tokenA.getAddress();
    console.log(`   DOGE Token: ${tokenAAddress}`);
    
    const tokenB = await MockERC20.deploy("Shiba Inu", "SHIB", 18);
    await tokenB.waitForDeployment();
    const tokenBAddress = await tokenB.getAddress();
    console.log(`   SHIB Token: ${tokenBAddress}`);
    
    const tokenC = await MockERC20.deploy("Pepe Coin", "PEPE", 18);
    await tokenC.waitForDeployment();
    const tokenCAddress = await tokenC.getAddress();
    console.log(`   PEPE Token: ${tokenCAddress}`);
    
    // 3. 토큰 민트 (기관이 보유할 토큰들)
    console.log("\n🏦 기관 토큰 보유량 설정 중...");
    const mintAmount = ethers.parseEther("1000000"); // 1M tokens each
    
    await tokenA.mint(deployer.address, mintAmount);
    await tokenB.mint(deployer.address, mintAmount);
    await tokenC.mint(deployer.address, mintAmount);
    
    console.log(`   DOGE Balance: ${ethers.formatEther(await tokenA.balanceOf(deployer.address))}`);
    console.log(`   SHIB Balance: ${ethers.formatEther(await tokenB.balanceOf(deployer.address))}`);
    console.log(`   PEPE Balance: ${ethers.formatEther(await tokenC.balanceOf(deployer.address))}`);
    
    // 4. 팩토리에서 토큰 승인
    console.log("\n✅ 토큰 승인 중...");
    await factory.authorizeToken(tokenAAddress, true);
    await factory.authorizeToken(tokenBAddress, true);
    await factory.authorizeToken(tokenCAddress, true);
    console.log("   모든 토큰이 승인되었습니다");
    
    // 5. 인덱스 레시피 생성
    console.log("\n📋 인덱스 레시피 생성 중...");
    const recipe = {
        tokens: [tokenAAddress, tokenBAddress, tokenCAddress],
        weights: [5000, 3000, 2000], // 50%, 30%, 20% 가중치 (basis points)
        name: "Meme Index Token",
        symbol: "MEME"
    };
    
    console.log(`   구성: DOGE(50%), SHIB(30%), PEPE(20%)`);
    console.log(`   Name: ${recipe.name}`);
    console.log(`   Symbol: ${recipe.symbol}`);
    
    // 6. 인덱스 토큰 생성 
    console.log("\n🚀 인덱스 토큰 생성 중...");
    const createTx = await factory.createIndexToken(
        recipe.name,
        recipe.symbol,
        recipe.tokens,
        recipe.weights
    );
    
    const receipt = await createTx.wait();
    console.log(`   Transaction Hash: ${receipt.hash}`);
    
    // 이벤트에서 생성된 인덱스 토큰 주소 추출
    let indexTokenAddress;
    for (const log of receipt.logs) {
        try {
            const parsed = factory.interface.parseLog(log);
            if (parsed.name === "IndexTokenCreated") {
                indexTokenAddress = parsed.args.indexToken;
                console.log(`   Index Token Created: ${indexTokenAddress}`);
                break;
            }
        } catch (e) {
            // 파싱 실패한 로그는 무시
        }
    }
    
    if (!indexTokenAddress) {
        throw new Error("인덱스 토큰 생성 실패");
    }
    
    // 7. 토큰 공급 (Issuance) 테스트
    console.log("\n💎 토큰 공급 테스트...");
    const IndexToken = await ethers.getContractFactory("IndexToken");
    const indexToken = IndexToken.attach(indexTokenAddress);
    
    // 각 기초자산 1000개씩 투입하여 인덱스 토큰 발행
    const issueAmount = ethers.parseEther("1000"); // 1000 tokens each
    
    // 승인
    await tokenA.approve(indexTokenAddress, issueAmount);
    await tokenB.approve(indexTokenAddress, issueAmount);
    await tokenC.approve(indexTokenAddress, issueAmount);
    
    // 발행
    const issueTx = await indexToken.issueTokens(
        [issueAmount, issueAmount, issueAmount],
        deployer.address
    );
    await issueTx.wait();
    
    const indexBalance = await indexToken.balanceOf(deployer.address);
    console.log(`   발행된 인덱스 토큰: ${ethers.formatEther(indexBalance)} ${recipe.symbol}`);
    
    // 8. 결과 검증
    console.log("\n📊 인덱스 토큰 정보 확인...");
    console.log(`   Name: ${await indexToken.name()}`);
    console.log(`   Symbol: ${await indexToken.symbol()}`);
    console.log(`   Total Supply: ${ethers.formatEther(await indexToken.totalSupply())}`);
    
    console.log("\n✅ 기관 인덱스 생성 워크플로우 테스트 완료!");
    return {
        success: true,
        indexToken: indexTokenAddress,
        underlyingTokens: {
            DOGE: tokenAAddress,
            SHIB: tokenBAddress,
            PEPE: tokenCAddress
        }
    };
}

async function main() {
    try {
        const result = await testInstitutionalIndex();
        console.log("\n🎉 테스트 성공!");
        console.log(`Index Token: ${result.indexToken}`);
        process.exit(0);
    } catch (error) {
        console.error("\n❌ 테스트 실패:", error.message);
        process.exit(1);
    }
}

main();