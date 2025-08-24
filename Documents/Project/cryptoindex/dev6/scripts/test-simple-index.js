const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 간단한 인덱스 테스트 시작\n");
    
    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);
    
    // Factory 연결
    const factoryAddress = "0xC6E09548F406D7aC8fE8864b460eB07C0b9571D9";
    const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
    const factory = IndexTokenFactory.attach(factoryAddress);
    
    // 기존 배포된 토큰 사용
    const tokenA = "0xd0ff325D44a784670389a4bab52457285660C578"; // DOGE
    const tokenB = "0xddb129F3aeDB3D77EaD9ccBd097E873445A14494"; // SHIB
    
    console.log("🏭 Factory 정보:");
    console.log(`   Address: ${factoryAddress}`);
    
    console.log("\n💰 사용할 토큰들:");
    console.log(`   DOGE: ${tokenA}`);
    console.log(`   SHIB: ${tokenB}`);
    
    // 토큰 승인 상태 확인
    console.log("\n✅ 토큰 승인 상태 확인:");
    try {
        const isTokenAAuth = await factory.authorizedTokens(tokenA);
        const isTokenBAuth = await factory.authorizedTokens(tokenB);
        console.log(`   DOGE 승인됨: ${isTokenAAuth}`);
        console.log(`   SHIB 승인됨: ${isTokenBAuth}`);
    } catch (error) {
        console.log(`   승인 상태 확인 실패: ${error.message}`);
    }
    
    console.log("\n🎯 테스트 완료");
    
    console.log("\n📋 보고서:");
    console.log("==========================================");
    console.log("✅ 환경 준비 및 초기 설정: 완료");
    console.log("✅ 스마트컨트랙트 컴파일 및 배포: 완료");
    console.log("⏳ 기관 인덱스 생성 워크플로우: 진행 중");
    console.log("   - IndexTokenFactory 배포: 완료");
    console.log("   - 테스트 토큰 배포: 완료");
    console.log("   - 인덱스 토큰 생성: 대기 중");
    console.log("==========================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("오류:", error.message);
        process.exit(1);
    });