// test-failure-scenarios.js
/**
 * HyperIndex 실패 우선 테스트 전략
 * "실패에서 배우는" 접근법
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("🚨 HyperIndex 실패 우선 테스트 - 엣지 케이스 중심");
    console.log("==============================================");
    console.log("💡 철학: 시스템이 어떻게 실패하는지 이해하는 것이 핵심");
    
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} HYPE`);
    
    // Load deployment info
    let deploymentInfo;
    try {
        deploymentInfo = JSON.parse(require('fs').readFileSync('testnet-deployment.json', 'utf8'));
        console.log("📋 Loaded deployment info");
    } catch (error) {
        console.error("❌ Could not load deployment info");
        return;
    }
    
    const failureTestResults = {
        edgeCases: [],
        economicAttacks: [],
        systemLimits: [],
        recoveryMechanisms: [],
        performanceUnderStress: {}
    };
    
    try {
        console.log("\n=== 🎯 Test 1: 시스템 한계 테스트 ===");
        
        // Get contract instances
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = IndexTokenFactory.attach(deploymentInfo.contracts.factory);
        
        const mockUSDC = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockUSDC);
        const mockWETH = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockWETH);
        const mockWBTC = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockWBTC);
        
        console.log("🔍 1-1: 최대 컴포넌트 수 테스트 (MAX_COMPONENTS = 10)");
        
        // 최대 10개 컴포넌트로 인덱스 생성 시도
        const maxComponents = [];
        for (let i = 0; i < 10; i++) {
            maxComponents.push({
                tokenAddress: i < 3 ? 
                    [deploymentInfo.contracts.mockUSDC, deploymentInfo.contracts.mockWETH, deploymentInfo.contracts.mockWBTC][i] :
                    deploymentInfo.contracts.mockUSDC, // 나머지는 USDC로
                hyperliquidAssetIndex: i,
                targetRatio: 1000, // 각각 10%
                depositedAmount: 0
            });
        }
        
        try {
            const maxComponentsTx = await factory.createIndexFund(
                "Max Components Test",
                "MAX10",
                maxComponents,
                { gasLimit: 5000000 }
            );
            
            const receipt = await maxComponentsTx.wait();
            console.log("     ✅ 10개 컴포넌트 인덱스 생성 성공");
            console.log(`     ⛽ 가스 사용: ${receipt.gasUsed}`);
            
            failureTestResults.systemLimits.push({
                test: "max_components",
                result: "success",
                gasUsed: receipt.gasUsed.toString(),
                componentCount: 10
            });
            
        } catch (error) {
            console.log(`     ❌ 10개 컴포넌트 실패: ${error.message}`);
            failureTestResults.systemLimits.push({
                test: "max_components",
                result: "failed",
                error: error.message,
                componentCount: 10
            });
        }
        
        console.log("🔍 1-2: 11개 컴포넌트 테스트 (한계 초과)");
        
        // 11개 컴포넌트로 시도 (실패해야 정상)
        const overMaxComponents = [...maxComponents, {
            tokenAddress: deploymentInfo.contracts.mockUSDC,
            hyperliquidAssetIndex: 10,
            targetRatio: 1000,
            depositedAmount: 0
        }];
        
        try {
            const overMaxTx = await factory.createIndexFund(
                "Over Max Test",
                "OVER11",
                overMaxComponents
            );
            
            console.log("     ⚠️ 11개 컴포넌트가 성공함 (예상 외)");
            failureTestResults.systemLimits.push({
                test: "over_max_components",
                result: "unexpected_success",
                componentCount: 11
            });
            
        } catch (error) {
            console.log("     ✅ 11개 컴포넌트 정상 차단");
            failureTestResults.systemLimits.push({
                test: "over_max_components",
                result: "correctly_failed",
                error: error.message,
                componentCount: 11
            });
        }
        
        console.log("\n=== 💰 Test 2: 경제적 공격 시뮬레이션 ===");
        
        console.log("🔍 2-1: 극단적 비율 설정 테스트");
        
        // 99.99% vs 0.01% 같은 극단적 비율
        const extremeRatioComponents = [
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
                extremeRatioComponents
            );
            
            const extremeReceipt = await extremeTx.wait();
            console.log("     ✅ 극단적 비율 설정 허용됨");
            console.log("     📊 99.99% USDC, 0.01% WETH 구성 생성");
            
            failureTestResults.economicAttacks.push({
                attack: "extreme_allocation",
                result: "allowed",
                gasUsed: extremeReceipt.gasUsed.toString(),
                ratios: "99.99% / 0.01%"
            });
            
        } catch (error) {
            console.log(`     ❌ 극단적 비율 차단: ${error.message}`);
            failureTestResults.economicAttacks.push({
                attack: "extreme_allocation",
                result: "blocked",
                error: error.message
            });
        }
        
        console.log("🔍 2-2: 잘못된 비율 합계 테스트");
        
        // 비율 합계가 100%가 아닌 경우
        const wrongTotalComponents = [
            {
                tokenAddress: deploymentInfo.contracts.mockUSDC,
                hyperliquidAssetIndex: 0,
                targetRatio: 6000, // 60%
                depositedAmount: 0
            },
            {
                tokenAddress: deploymentInfo.contracts.mockWETH,
                hyperliquidAssetIndex: 1,
                targetRatio: 3000, // 30% (총 90% - 잘못됨)
                depositedAmount: 0
            }
        ];
        
        try {
            const wrongTotalTx = await factory.createIndexFund(
                "Wrong Total Test",
                "WRONG90",
                wrongTotalComponents
            );
            
            console.log("     ⚠️ 잘못된 비율 합계 허용됨 (90%)");
            failureTestResults.economicAttacks.push({
                attack: "wrong_ratio_total",
                result: "unexpectedly_allowed",
                total: "90%"
            });
            
        } catch (error) {
            console.log("     ✅ 잘못된 비율 합계 정상 차단");
            failureTestResults.economicAttacks.push({
                attack: "wrong_ratio_total",
                result: "correctly_blocked",
                error: error.message,
                total: "90%"
            });
        }
        
        console.log("\n=== ⚡ Test 3: 성능 스트레스 테스트 ===");
        
        console.log("🔍 3-1: 빠른 연속 생성 테스트");
        
        const rapidCreationResults = [];
        const rapidTestStart = Date.now();
        
        // 3개 인덱스를 빠르게 연속 생성
        for (let i = 0; i < 3; i++) {
            const startTime = Date.now();
            
            try {
                const rapidTx = await factory.createIndexFund(
                    `Rapid Test ${i}`,
                    `RAPID${i}`,
                    [
                        {
                            tokenAddress: deploymentInfo.contracts.mockUSDC,
                            hyperliquidAssetIndex: 0,
                            targetRatio: 5000,
                            depositedAmount: 0
                        },
                        {
                            tokenAddress: deploymentInfo.contracts.mockWETH,
                            hyperliquidAssetIndex: 1,
                            targetRatio: 5000,
                            depositedAmount: 0
                        }
                    ]
                );
                
                const rapidReceipt = await rapidTx.wait();
                const endTime = Date.now();
                
                rapidCreationResults.push({
                    index: i,
                    success: true,
                    time: endTime - startTime,
                    gasUsed: rapidReceipt.gasUsed.toString(),
                    txHash: rapidTx.hash
                });
                
                console.log(`     📊 Rapid ${i}: ${endTime - startTime}ms, ${rapidReceipt.gasUsed} gas`);
                
            } catch (error) {
                const endTime = Date.now();
                rapidCreationResults.push({
                    index: i,
                    success: false,
                    time: endTime - startTime,
                    error: error.message
                });
                
                console.log(`     ❌ Rapid ${i} 실패: ${error.message}`);
            }
        }
        
        const rapidTestEnd = Date.now();
        const totalRapidTime = rapidTestEnd - rapidTestStart;
        
        console.log(`     📊 연속 생성 총 시간: ${totalRapidTime}ms`);
        console.log(`     📊 평균 처리 시간: ${totalRapidTime / 3}ms`);
        
        failureTestResults.performanceUnderStress = {
            rapidCreation: rapidCreationResults,
            totalTime: totalRapidTime,
            averageTime: totalRapidTime / 3,
            successRate: rapidCreationResults.filter(r => r.success).length / 3 * 100
        };
        
        console.log("\n=== 🔄 Test 4: 복구 메커니즘 테스트 ===");
        
        console.log("🔍 4-1: 유효하지 않은 토큰 주소 테스트");
        
        const invalidTokenComponents = [
            {
                tokenAddress: ethers.ZeroAddress, // 잘못된 주소
                hyperliquidAssetIndex: 0,
                targetRatio: 5000,
                depositedAmount: 0
            },
            {
                tokenAddress: deploymentInfo.contracts.mockWETH,
                hyperliquidAssetIndex: 1,
                targetRatio: 5000,
                depositedAmount: 0
            }
        ];
        
        try {
            const invalidTokenTx = await factory.createIndexFund(
                "Invalid Token Test",
                "INVALID",
                invalidTokenComponents
            );
            
            console.log("     ⚠️ 유효하지 않은 토큰 주소 허용됨");
            failureTestResults.recoveryMechanisms.push({
                test: "invalid_token_address",
                result: "unexpectedly_allowed"
            });
            
        } catch (error) {
            console.log("     ✅ 유효하지 않은 토큰 주소 정상 차단");
            failureTestResults.recoveryMechanisms.push({
                test: "invalid_token_address",
                result: "correctly_blocked",
                error: error.message
            });
        }
        
        console.log("🔍 4-2: 빈 문자열 이름/심볼 테스트");
        
        try {
            const emptyStringTx = await factory.createIndexFund(
                "", // 빈 이름
                "", // 빈 심볼
                [
                    {
                        tokenAddress: deploymentInfo.contracts.mockUSDC,
                        hyperliquidAssetIndex: 0,
                        targetRatio: 10000,
                        depositedAmount: 0
                    }
                ]
            );
            
            console.log("     ⚠️ 빈 문자열 이름/심볼 허용됨");
            failureTestResults.recoveryMechanisms.push({
                test: "empty_name_symbol",
                result: "unexpectedly_allowed"
            });
            
        } catch (error) {
            console.log("     ✅ 빈 문자열 이름/심볼 정상 차단");
            failureTestResults.recoveryMechanisms.push({
                test: "empty_name_symbol",
                result: "correctly_blocked",
                error: error.message
            });
        }
        
        console.log("\n=== 📊 실패 시나리오 종합 분석 ===");
        
        // 실패율 분석
        const totalTests = 
            failureTestResults.systemLimits.length +
            failureTestResults.economicAttacks.length +
            failureTestResults.recoveryMechanisms.length;
        
        const correctFailures = [
            ...failureTestResults.systemLimits,
            ...failureTestResults.economicAttacks, 
            ...failureTestResults.recoveryMechanisms
        ].filter(test => 
            test.result === "correctly_failed" || 
            test.result === "correctly_blocked"
        ).length;
        
        const unexpectedSuccesses = [
            ...failureTestResults.systemLimits,
            ...failureTestResults.economicAttacks,
            ...failureTestResults.recoveryMechanisms
        ].filter(test => 
            test.result === "unexpected_success" || 
            test.result === "unexpectedly_allowed"
        ).length;
        
        const correctFailureRate = (correctFailures / totalTests) * 100;
        const unexpectedSuccessRate = (unexpectedSuccesses / totalTests) * 100;
        
        console.log("📈 실패 시나리오 분석:");
        console.log(`   📊 총 테스트: ${totalTests}개`);
        console.log(`   ✅ 정상 차단: ${correctFailures}개 (${correctFailureRate.toFixed(1)}%)`);
        console.log(`   ⚠️ 예상외 성공: ${unexpectedSuccesses}개 (${unexpectedSuccessRate.toFixed(1)}%)`);
        console.log(`   🎯 시스템 안정성: ${correctFailureRate >= 80 ? '높음' : '개선필요'}`);
        
        // 성능 분석
        const avgRapidTime = failureTestResults.performanceUnderStress.averageTime;
        const rapidSuccessRate = failureTestResults.performanceUnderStress.successRate;
        
        console.log("⚡ 성능 스트레스 분석:");
        console.log(`   📊 평균 처리 시간: ${avgRapidTime.toFixed(0)}ms`);
        console.log(`   📊 연속 처리 성공률: ${rapidSuccessRate}%`);
        console.log(`   🎯 성능 등급: ${avgRapidTime < 15000 ? '우수' : avgRapidTime < 30000 ? '양호' : '개선필요'}`);
        
        // 보안 점수 계산
        const securityScore = Math.min(100, correctFailureRate + (rapidSuccessRate * 0.2));
        
        console.log("🛡️ 보안 점수:");
        console.log(`   📊 종합 보안 점수: ${securityScore.toFixed(1)}/100`);
        console.log(`   🎯 보안 등급: ${securityScore >= 90 ? 'A+' : securityScore >= 80 ? 'A' : securityScore >= 70 ? 'B' : 'C'}`);
        
        // 권장사항
        const recommendations = [];
        
        if (unexpectedSuccessRate > 20) {
            recommendations.push("⚠️ 입력 검증 로직 강화 필요");
        }
        
        if (avgRapidTime > 20000) {
            recommendations.push("⚠️ 성능 최적화 필요");
        }
        
        if (rapidSuccessRate < 90) {
            recommendations.push("⚠️ 동시성 처리 개선 필요");
        }
        
        if (recommendations.length === 0) {
            recommendations.push("✅ 모든 실패 시나리오 적절히 처리됨");
        }
        
        console.log("\n💡 권장사항:");
        recommendations.forEach(rec => console.log(`   ${rec}`));
        
        // 최종 평가
        const overallRating = securityScore >= 85 && avgRapidTime < 20000 && rapidSuccessRate >= 90 ? "EXCELLENT" :
                            securityScore >= 75 && avgRapidTime < 30000 && rapidSuccessRate >= 80 ? "GOOD" :
                            securityScore >= 65 ? "ACCEPTABLE" : "NEEDS_IMPROVEMENT";
        
        console.log(`\n🏆 종합 평가: ${overallRating}`);
        
        // 결과 저장
        const finalResults = {
            ...failureTestResults,
            analysis: {
                totalTests: totalTests,
                correctFailures: correctFailures,
                unexpectedSuccesses: unexpectedSuccesses,
                correctFailureRate: correctFailureRate,
                securityScore: securityScore,
                performanceRating: avgRapidTime < 15000 ? 'excellent' : avgRapidTime < 30000 ? 'good' : 'needs_improvement',
                overallRating: overallRating,
                recommendations: recommendations
            }
        };
        
        // 배포 정보 업데이트
        if (!deploymentInfo.mvpTests) {
            deploymentInfo.mvpTests = {};
        }
        
        deploymentInfo.mvpTests.failureScenarios = {
            timestamp: new Date().toISOString(),
            status: "completed",
            results: finalResults
        };
        
        console.log("\n💾 실패 시나리오 테스트 결과 저장...");
        require('fs').writeFileSync(
            'testnet-deployment.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        console.log("   ✅ 결과 저장 완료");
        
        return {
            success: true,
            overallRating: overallRating,
            securityScore: securityScore,
            results: finalResults
        };
        
    } catch (error) {
        console.error(`\n❌ 실패 시나리오 테스트 실패: ${error.message}`);
        console.error("Stack trace:", error.stack);
        
        // 실패 결과 저장
        deploymentInfo.mvpTests = {
            ...deploymentInfo.mvpTests,
            failureScenarios: {
                timestamp: new Date().toISOString(),
                status: "failed",
                error: error.message,
                partialResults: failureTestResults
            }
        };
        
        require('fs').writeFileSync(
            'testnet-deployment.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        
        throw error;
    }
}

main()
    .then((results) => {
        console.log("\n🎉 실패 시나리오 테스트 완료!");
        console.log(`🏆 종합 평가: ${results.overallRating}`);
        console.log(`🛡️ 보안 점수: ${results.securityScore.toFixed(1)}/100`);
        console.log("💡 시스템의 실패 패턴과 복구 능력을 이해했습니다!");
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });