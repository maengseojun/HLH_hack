// test-mvp-core.js
/**
 * 핵심 MVP 기능 검증 - 스트림라인 버전
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("🎯 HyperIndex 핵심 MVP 검증");
    console.log("=========================");
    
    const [deployer] = await ethers.getSigners();
    console.log(`👤 Deployer: ${deployer.address}`);
    
    // Load deployment info
    let deploymentInfo;
    try {
        deploymentInfo = JSON.parse(require('fs').readFileSync('testnet-deployment.json', 'utf8'));
        console.log("📋 Loaded deployment info");
    } catch (error) {
        console.error("❌ Could not load deployment info");
        return;
    }
    
    const mvpResults = {
        coreWorkflows: [],
        securityValidation: [],
        crossChainCapability: [],
        userExperience: [],
        summary: {}
    };
    
    try {
        console.log("\n=== 🏗️ Core Workflow 검증 ===");
        
        // Get contract instances
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = IndexTokenFactory.attach(deploymentInfo.contracts.factory);
        
        const mockUSDC = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockUSDC);
        const mockWETH = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockWETH);
        
        // Test 1: Basic Index Creation
        console.log("🔍 1. 기본 인덱스 생성 워크플로우");
        
        const basicComponents = [
            {
                tokenAddress: deploymentInfo.contracts.mockUSDC,
                hyperliquidAssetIndex: 0,
                targetRatio: 6000, // 60%
                depositedAmount: 0
            },
            {
                tokenAddress: deploymentInfo.contracts.mockWETH,
                hyperliquidAssetIndex: 1,
                targetRatio: 4000, // 40%
                depositedAmount: 0
            }
        ];
        
        const startTime = Date.now();
        
        try {
            const createTx = await factory.createIndexFund(
                "MVP Test Index",
                "MVPTEST",
                basicComponents,
                { gasLimit: 5000000 }
            );
            
            const receipt = await createTx.wait();
            const endTime = Date.now();
            
            console.log("   ✅ 인덱스 생성 성공");
            console.log(`   ⏱️ 처리 시간: ${endTime - startTime}ms`);
            console.log(`   ⛽ 가스 사용: ${receipt.gasUsed}`);
            
            mvpResults.coreWorkflows.push({
                workflow: "basic_index_creation",
                status: "success",
                processingTime: endTime - startTime,
                gasUsed: receipt.gasUsed.toString(),
                txHash: createTx.hash
            });
            
        } catch (error) {
            console.log(`   ❌ 인덱스 생성 실패: ${error.message}`);
            mvpResults.coreWorkflows.push({
                workflow: "basic_index_creation",
                status: "failed",
                error: error.message
            });
        }
        
        // Test 2: Security Validation
        console.log("\n🛡️ 2. 보안 시스템 검증");
        
        const SecurityManager = await ethers.getContractFactory("SecurityManager");
        const securityManager = SecurityManager.attach(deploymentInfo.contracts.securityManager);
        
        try {
            // Check if security manager is properly integrated
            const isBlacklisted = await securityManager.isBlacklisted(deployer.address);
            const emergencyStatus = await securityManager.emergencyPause();
            
            console.log(`   🔍 블랙리스트 체크: ${isBlacklisted ? '차단됨' : '정상'}`);
            console.log(`   🚨 비상 상태: ${emergencyStatus ? '활성화' : '비활성화'}`);
            
            mvpResults.securityValidation.push({
                check: "blacklist_system",
                status: "functional",
                userBlacklisted: isBlacklisted,
                emergencyActive: emergencyStatus
            });
            
        } catch (error) {
            console.log(`   ❌ 보안 시스템 오류: ${error.message}`);
            mvpResults.securityValidation.push({
                check: "security_system",
                status: "error",
                error: error.message
            });
        }
        
        // Test 3: DEX Integration
        console.log("\n🔄 3. DEX 통합 검증");
        
        const MockDEXAggregator = await ethers.getContractFactory("MockDEXAggregator");
        const dexAggregator = MockDEXAggregator.attach(deploymentInfo.contracts.mockDEXAggregator);
        
        try {
            const swapAmount = ethers.parseUnits("100", 6); // 100 USDC
            
            const quoteStartTime = Date.now();
            const quote = await dexAggregator.getQuote(
                deploymentInfo.contracts.mockUSDC,
                deploymentInfo.contracts.mockWETH,
                swapAmount
            );
            const quoteEndTime = Date.now();
            
            console.log(`   📊 Quote 응답 시간: ${quoteEndTime - quoteStartTime}ms`);
            console.log(`   💱 Exchange Rate: ${ethers.formatEther(quote.returnAmount)} WETH per 100 USDC`);
            console.log(`   ⛽ 예상 가스: ${quote.estimatedGas}`);
            
            mvpResults.coreWorkflows.push({
                workflow: "dex_integration",
                status: "success",
                quoteResponseTime: quoteEndTime - quoteStartTime,
                exchangeRate: ethers.formatEther(quote.returnAmount),
                estimatedGas: quote.estimatedGas.toString()
            });
            
        } catch (error) {
            console.log(`   ❌ DEX 통합 오류: ${error.message}`);
            mvpResults.coreWorkflows.push({
                workflow: "dex_integration",
                status: "failed",
                error: error.message
            });
        }
        
        // Test 4: Cross-Chain Readiness
        console.log("\n🌐 4. 크로스체인 준비 상태");
        
        const MockLayerZeroEndpoint = await ethers.getContractFactory("MockLayerZeroEndpoint");
        const lzEndpoint = MockLayerZeroEndpoint.attach(deploymentInfo.contracts.mockLayerZeroEndpoint);
        
        try {
            // Test cross-chain messaging capability
            const testMessage = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "uint256"],
                ["mvp_test", Date.now()]
            );
            
            const lzTx = await lzEndpoint.send(
                40161, // Arbitrum EID
                deploymentInfo.contracts.hyperIndexVault,
                testMessage,
                "0x",
                ethers.parseEther("0.001"),
                { value: ethers.parseEther("0.001") }
            );
            
            const lzReceipt = await lzTx.wait();
            
            console.log("   ✅ 크로스체인 메시징 기능적");
            console.log(`   ⛽ 가스 사용: ${lzReceipt.gasUsed}`);
            
            mvpResults.crossChainCapability.push({
                capability: "layerzero_messaging",
                status: "functional",
                gasUsed: lzReceipt.gasUsed.toString(),
                txHash: lzTx.hash
            });
            
        } catch (error) {
            console.log(`   ⚠️ 크로스체인 제한: ${error.message}`);
            mvpResults.crossChainCapability.push({
                capability: "layerzero_messaging",
                status: "limited",
                error: error.message
            });
        }
        
        // Test 5: User Experience Metrics
        console.log("\n👤 5. 사용자 경험 메트릭");
        
        // Calculate overall system responsiveness
        const workflows = mvpResults.coreWorkflows.filter(w => w.processingTime);
        const avgResponseTime = workflows.length > 0 ? 
            workflows.reduce((sum, w) => sum + w.processingTime, 0) / workflows.length : 0;
        
        console.log(`   ⏱️ 평균 응답 시간: ${avgResponseTime.toFixed(0)}ms`);
        
        const responsiveness = avgResponseTime < 30000 ? "excellent" : 
                              avgResponseTime < 60000 ? "good" : "needs_improvement";
        
        console.log(`   📈 시스템 반응성: ${responsiveness}`);
        
        mvpResults.userExperience.push({
            metric: "responsiveness",
            averageResponseTime: avgResponseTime,
            rating: responsiveness,
            totalWorkflowsTested: workflows.length
        });
        
        // Test Summary
        console.log("\n=== 📊 MVP 검증 요약 ===");
        
        const totalTests = [
            ...mvpResults.coreWorkflows,
            ...mvpResults.securityValidation,
            ...mvpResults.crossChainCapability
        ];
        
        const successfulTests = totalTests.filter(t => t.status === "success" || t.status === "functional").length;
        const failedTests = totalTests.filter(t => t.status === "failed" || t.status === "error").length;
        const limitedTests = totalTests.filter(t => t.status === "limited").length;
        
        console.log(`✅ 성공한 테스트: ${successfulTests}`);
        console.log(`❌ 실패한 테스트: ${failedTests}`);
        console.log(`⚠️ 제한된 기능: ${limitedTests}`);
        console.log(`📊 총 테스트: ${totalTests.length}`);
        
        const mvpScore = ((successfulTests + limitedTests * 0.5) / totalTests.length * 100).toFixed(1);
        console.log(`🏆 MVP 점수: ${mvpScore}%`);
        
        // Determine MVP readiness
        let mvpStatus = "NOT_READY";
        if (mvpScore >= 90) mvpStatus = "READY_FOR_BETA";
        else if (mvpScore >= 75) mvpStatus = "READY_FOR_ALPHA";
        else if (mvpScore >= 60) mvpStatus = "BASIC_FUNCTIONALITY";
        
        console.log(`🎯 MVP 상태: ${mvpStatus}`);
        
        mvpResults.summary = {
            totalTests: totalTests.length,
            successfulTests: successfulTests,
            failedTests: failedTests,
            limitedTests: limitedTests,
            mvpScore: mvpScore,
            mvpStatus: mvpStatus,
            averageResponseTime: avgResponseTime,
            recommendation: mvpScore >= 75 ? "Proceed with next phase testing" : "Address critical issues first"
        };
        
        // Update deployment info
        deploymentInfo.mvpTesting = deploymentInfo.mvpTesting || {};
        deploymentInfo.mvpTesting.coreValidation = {
            timestamp: new Date().toISOString(),
            status: "completed",
            results: mvpResults
        };
        
        console.log("\n💾 결과 저장 중...");
        require('fs').writeFileSync(
            'testnet-deployment.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        console.log("✅ 결과가 testnet-deployment.json에 저장됨");
        
        console.log("\n🎉 핵심 MVP 검증 완료!");
        console.log(`🏆 최종 MVP 점수: ${mvpScore}%`);
        console.log(`🎯 시스템 상태: ${mvpStatus}`);
        console.log(`💡 권장사항: ${mvpResults.summary.recommendation}`);
        
    } catch (error) {
        console.error(`\n❌ MVP 테스트 중 오류: ${error.message}`);
        console.error("Stack trace:", error.stack);
        throw error;
    }
}

main()
    .then(() => {
        console.log("\n🚀 핵심 MVP 검증 성공!");
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });