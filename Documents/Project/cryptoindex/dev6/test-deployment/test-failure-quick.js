// test-failure-quick.js
/**
 * 빠른 실패 우선 테스트 - 핵심 엣지 케이스만
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("🚨 빠른 실패 우선 테스트");
    console.log("====================");
    
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
    
    const testResults = {
        tests: [],
        summary: {}
    };
    
    try {
        // Get contract instances
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = IndexTokenFactory.attach(deploymentInfo.contracts.factory);
        
        console.log("\n=== 🎯 Test 1: 시스템 한계 테스트 ===");
        
        // Test 1: Maximum components (should succeed)
        console.log("🔍 1-1: 최대 컴포넌트 수 테스트 (10개)");
        
        const maxComponents = [];
        for (let i = 0; i < 10; i++) {
            maxComponents.push({
                tokenAddress: deploymentInfo.contracts.mockUSDC,
                hyperliquidAssetIndex: i,
                targetRatio: 1000, // 10% each
                depositedAmount: 0
            });
        }
        
        try {
            const maxTx = await factory.createIndexFund(
                "Max Components Test",
                "MAX10",
                maxComponents,
                { gasLimit: 5000000 }
            );
            
            const receipt = await maxTx.wait();
            console.log("     ✅ 10개 컴포넌트 성공");
            console.log(`     ⛽ 가스: ${receipt.gasUsed}`);
            
            testResults.tests.push({
                name: "max_components_10",
                result: "success",
                gasUsed: receipt.gasUsed.toString()
            });
            
        } catch (error) {
            console.log(`     ❌ 10개 컴포넌트 실패: ${error.message}`);
            testResults.tests.push({
                name: "max_components_10",
                result: "failed",
                error: error.message
            });
        }
        
        // Test 2: Over maximum components (should fail)
        console.log("🔍 1-2: 한계 초과 테스트 (11개)");
        
        const overMaxComponents = [...maxComponents, {
            tokenAddress: deploymentInfo.contracts.mockUSDC,
            hyperliquidAssetIndex: 10,
            targetRatio: 1000,
            depositedAmount: 0
        }];
        
        try {
            await factory.createIndexFund(
                "Over Max Test",
                "OVER11",
                overMaxComponents
            );
            
            console.log("     ⚠️ 11개 컴포넌트 성공 (예상 외)");
            testResults.tests.push({
                name: "over_max_components_11",
                result: "unexpected_success"
            });
            
        } catch (error) {
            console.log("     ✅ 11개 컴포넌트 정상 차단");
            testResults.tests.push({
                name: "over_max_components_11",
                result: "correctly_blocked",
                error: error.message
            });
        }
        
        console.log("\n=== 💰 Test 2: 경제적 공격 시뮬레이션 ===");
        
        // Test 3: Wrong ratio sum (should fail)
        console.log("🔍 2-1: 잘못된 비율 합계 테스트");
        
        const wrongRatioComponents = [
            {
                tokenAddress: deploymentInfo.contracts.mockUSDC,
                hyperliquidAssetIndex: 0,
                targetRatio: 4000, // 40%
                depositedAmount: 0
            },
            {
                tokenAddress: deploymentInfo.contracts.mockWETH,
                hyperliquidAssetIndex: 1,
                targetRatio: 5000, // 50% (total = 90%, not 100%)
                depositedAmount: 0
            }
        ];
        
        try {
            await factory.createIndexFund(
                "Wrong Ratio Test",
                "WRONG",
                wrongRatioComponents
            );
            
            console.log("     ⚠️ 잘못된 비율 허용됨 (예상 외)");
            testResults.tests.push({
                name: "wrong_ratio_sum",
                result: "unexpected_success"
            });
            
        } catch (error) {
            console.log("     ✅ 잘못된 비율 정상 차단");
            testResults.tests.push({
                name: "wrong_ratio_sum",
                result: "correctly_blocked",
                error: error.message
            });
        }
        
        // Test 4: Extreme ratios (edge case)
        console.log("🔍 2-2: 극단적 비율 테스트 (99.99% vs 0.01%)");
        
        const extremeComponents = [
            {
                tokenAddress: deploymentInfo.contracts.mockUSDC,
                hyperliquidAssetIndex: 0,
                targetRatio: 9999, // 99.99%
                depositedAmount: 0
            },
            {
                tokenAddress: deploymentInfo.contracts.mockWETH,
                hyperliquidAssetIndex: 1,
                targetRatio: 1, // 0.01%
                depositedAmount: 0
            }
        ];
        
        try {
            const extremeTx = await factory.createIndexFund(
                "Extreme Ratio Test",
                "EXTREME",
                extremeComponents
            );
            
            console.log("     ✅ 극단적 비율 허용됨");
            testResults.tests.push({
                name: "extreme_ratios",
                result: "success",
                note: "99.99% vs 0.01% allowed"
            });
            
        } catch (error) {
            console.log(`     ❌ 극단적 비율 차단됨: ${error.message}`);
            testResults.tests.push({
                name: "extreme_ratios",
                result: "blocked",
                error: error.message
            });
        }
        
        console.log("\n=== ⚡ Test 3: 무효 입력 테스트 ===");
        
        // Test 5: Zero components (should fail)
        console.log("🔍 3-1: 빈 컴포넌트 배열 테스트");
        
        try {
            await factory.createIndexFund(
                "Empty Test",
                "EMPTY",
                []
            );
            
            console.log("     ⚠️ 빈 배열 허용됨 (예상 외)");
            testResults.tests.push({
                name: "empty_components",
                result: "unexpected_success"
            });
            
        } catch (error) {
            console.log("     ✅ 빈 배열 정상 차단");
            testResults.tests.push({
                name: "empty_components",
                result: "correctly_blocked",
                error: error.message
            });
        }
        
        // Test 6: Invalid token address (should fail)
        console.log("🔍 3-2: 무효한 토큰 주소 테스트");
        
        const invalidTokenComponents = [
            {
                tokenAddress: "0x0000000000000000000000000000000000000000",
                hyperliquidAssetIndex: 0,
                targetRatio: 10000, // 100%
                depositedAmount: 0
            }
        ];
        
        try {
            await factory.createIndexFund(
                "Invalid Token Test",
                "INVALID",
                invalidTokenComponents
            );
            
            console.log("     ⚠️ 무효한 토큰 주소 허용됨 (예상 외)");
            testResults.tests.push({
                name: "invalid_token_address",
                result: "unexpected_success"
            });
            
        } catch (error) {
            console.log("     ✅ 무효한 토큰 주소 정상 차단");
            testResults.tests.push({
                name: "invalid_token_address",
                result: "correctly_blocked",
                error: error.message
            });
        }
        
        // 결과 요약
        console.log("\n=== 📊 테스트 결과 요약 ===");
        
        const successCount = testResults.tests.filter(t => t.result === "success").length;
        const blockedCount = testResults.tests.filter(t => t.result === "correctly_blocked").length;
        const unexpectedCount = testResults.tests.filter(t => t.result === "unexpected_success").length;
        const failedCount = testResults.tests.filter(t => t.result === "failed").length;
        
        console.log(`✅ 정상 성공: ${successCount}`);
        console.log(`🛡️ 정상 차단: ${blockedCount}`);
        console.log(`⚠️ 예상 외 성공: ${unexpectedCount}`);
        console.log(`❌ 예상 외 실패: ${failedCount}`);
        console.log(`📊 총 테스트: ${testResults.tests.length}`);
        
        const securityScore = ((blockedCount + successCount) / testResults.tests.length * 100).toFixed(1);
        console.log(`🛡️ 보안 점수: ${securityScore}%`);
        
        testResults.summary = {
            totalTests: testResults.tests.length,
            successfulTests: successCount,
            properlyBlockedTests: blockedCount,
            unexpectedSuccesses: unexpectedCount,
            unexpectedFailures: failedCount,
            securityScore: securityScore
        };
        
        // Update deployment info
        deploymentInfo.mvpTesting = deploymentInfo.mvpTesting || {};
        deploymentInfo.mvpTesting.failureFirstTesting = {
            timestamp: new Date().toISOString(),
            status: "completed",
            results: testResults
        };
        
        console.log("\n💾 결과 저장 중...");
        require('fs').writeFileSync(
            'testnet-deployment.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        console.log("✅ 결과가 testnet-deployment.json에 저장됨");
        
        console.log("\n🎉 실패 우선 테스트 완료!");
        console.log(`🏆 시스템 보안 점수: ${securityScore}%`);
        
    } catch (error) {
        console.error(`\n❌ 테스트 실행 중 오류: ${error.message}`);
        console.error("Stack trace:", error.stack);
        throw error;
    }
}

main()
    .then(() => {
        console.log("\n🚀 실패 우선 테스트 성공!");
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });