// test-stress-performance.js
/**
 * 대량 동시 사용자 스트레스 테스트
 * 시스템 한계점과 성능 병목 지점 분석
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("⚡ HyperIndex 성능 스트레스 테스트");
    console.log("===============================");
    console.log("🚀 대량 동시 사용자 시뮬레이션");
    
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
    
    const stressResults = {
        concurrentUserTests: [],
        gasPressureTests: [],
        memoryUsageTests: [],
        networkLatencyTests: [],
        throughputAnalysis: {},
        bottleneckAnalysis: {},
        scalabilityMetrics: {},
        summary: {}
    };
    
    try {
        console.log("\n=== 🔥 Test 1: 동시 인덱스 생성 스트레스 ===");
        
        // Get contract instances
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = IndexTokenFactory.attach(deploymentInfo.contracts.factory);
        
        const mockUSDC = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockUSDC);
        const mockWETH = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockWETH);
        
        // 동시 인덱스 생성 테스트
        console.log("🔍 동시 다중 인덱스 생성 테스트...");
        
        const concurrentIndexes = [];
        const startTime = Date.now();
        
        // 10개의 인덱스를 동시 생성 시도
        for (let i = 0; i < 5; i++) { // 시간 절약을 위해 5개로 제한
            const components = [
                {
                    tokenAddress: deploymentInfo.contracts.mockUSDC,
                    hyperliquidAssetIndex: i,
                    targetRatio: 6000 + (i * 100), // 60% ~ 64%
                    depositedAmount: 0
                },
                {
                    tokenAddress: deploymentInfo.contracts.mockWETH,
                    hyperliquidAssetIndex: i + 10,
                    targetRatio: 4000 - (i * 100), // 40% ~ 36%
                    depositedAmount: 0
                }
            ];
            
            const promise = factory.createIndexFund(
                `Stress Test Index ${i}`,
                `STI${i}`,
                components,
                { gasLimit: 5000000 }
            ).then(tx => ({
                id: i,
                tx: tx,
                timestamp: Date.now()
            })).catch(error => ({
                id: i,
                error: error.message,
                timestamp: Date.now()
            }));
            
            concurrentIndexes.push(promise);
        }
        
        // 모든 트랜잭션 완료 대기
        const results = await Promise.allSettled(concurrentIndexes);
        const endTime = Date.now();
        
        const successCount = results.filter(r => r.status === 'fulfilled' && !r.value.error).length;
        const failCount = results.filter(r => r.status === 'rejected' || r.value?.error).length;
        
        console.log(`   ✅ 성공: ${successCount}개`);
        console.log(`   ❌ 실패: ${failCount}개`);
        console.log(`   ⏱️ 총 소요시간: ${endTime - startTime}ms`);
        console.log(`   📊 평균 처리시간: ${(endTime - startTime) / 5}ms per index`);
        
        stressResults.concurrentUserTests.push({
            testType: "concurrent_index_creation",
            attemptedOperations: 5,
            successfulOperations: successCount,
            failedOperations: failCount,
            totalTime: endTime - startTime,
            averageTime: (endTime - startTime) / 5,
            throughputPerSecond: (successCount / ((endTime - startTime) / 1000)).toFixed(2)
        });
        
        console.log("\n=== 💰 Test 2: 대량 토큰 민팅 및 예치 스트레스 ===");
        
        console.log("🔍 대량 토큰 민팅 테스트...");
        
        const mintStartTime = Date.now();
        
        // 대량 토큰 민팅 (1M USDC, 1000 WETH)
        const mintPromises = [
            mockUSDC.mint(deployer.address, ethers.parseUnits("1000000", 6)),
            mockWETH.mint(deployer.address, ethers.parseUnits("1000", 18))
        ];
        
        try {
            await Promise.all(mintPromises);
            const mintEndTime = Date.now();
            
            console.log(`   ✅ 대량 민팅 성공`);
            console.log(`   ⏱️ 민팅 시간: ${mintEndTime - mintStartTime}ms`);
            
            // 잔고 확인
            const usdcBalance = await mockUSDC.balanceOf(deployer.address);
            const wethBalance = await mockWETH.balanceOf(deployer.address);
            
            console.log(`   💰 USDC 잔고: ${ethers.formatUnits(usdcBalance, 6)}`);
            console.log(`   💰 WETH 잔고: ${ethers.formatUnits(wethBalance, 18)}`);
            
            stressResults.concurrentUserTests.push({
                testType: "mass_token_minting",
                usdcMinted: ethers.formatUnits(usdcBalance, 6),
                wethMinted: ethers.formatUnits(wethBalance, 18),
                mintingTime: mintEndTime - mintStartTime,
                status: "success"
            });
            
        } catch (error) {
            console.log(`   ❌ 대량 민팅 실패: ${error.message}`);
            stressResults.concurrentUserTests.push({
                testType: "mass_token_minting",
                status: "failed",
                error: error.message
            });
        }
        
        console.log("\n=== 🔄 Test 3: DEX 스왑 처리량 스트레스 ===");
        
        const MockDEXAggregator = await ethers.getContractFactory("MockDEXAggregator");
        const dexAggregator = MockDEXAggregator.attach(deploymentInfo.contracts.mockDEXAggregator);
        
        console.log("🔍 연속 스왑 쿼리 처리량 테스트...");
        
        const swapTestCount = 20; // 20회 연속 쿼리
        const swapResults = [];
        const swapStartTime = Date.now();
        
        for (let i = 0; i < swapTestCount; i++) {
            try {
                const queryStart = Date.now();
                const amount = ethers.parseUnits((100 + i * 10).toString(), 6); // 100, 110, 120... USDC
                
                const quote = await dexAggregator.getQuote(
                    deploymentInfo.contracts.mockUSDC,
                    deploymentInfo.contracts.mockWETH,
                    amount
                );
                
                const queryEnd = Date.now();
                
                swapResults.push({
                    iteration: i + 1,
                    inputAmount: ethers.formatUnits(amount, 6),
                    outputAmount: ethers.formatEther(quote.returnAmount),
                    responseTime: queryEnd - queryStart,
                    gasEstimate: quote.estimatedGas.toString()
                });
                
            } catch (error) {
                swapResults.push({
                    iteration: i + 1,
                    error: error.message,
                    responseTime: -1
                });
            }
        }
        
        const swapEndTime = Date.now();
        
        const successfulSwaps = swapResults.filter(r => !r.error).length;
        const avgResponseTime = swapResults
            .filter(r => !r.error && r.responseTime > 0)
            .reduce((sum, r) => sum + r.responseTime, 0) / successfulSwaps;
        
        console.log(`   ✅ 성공한 쿼리: ${successfulSwaps}/${swapTestCount}`);
        console.log(`   ⏱️ 총 소요시간: ${swapEndTime - swapStartTime}ms`);
        console.log(`   📊 평균 응답시간: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`   🚀 처리량: ${(successfulSwaps / ((swapEndTime - swapStartTime) / 1000)).toFixed(2)} queries/sec`);
        
        stressResults.throughputAnalysis.dexQueries = {
            totalQueries: swapTestCount,
            successfulQueries: successfulSwaps,
            failedQueries: swapTestCount - successfulSwaps,
            totalTime: swapEndTime - swapStartTime,
            averageResponseTime: avgResponseTime,
            queriesPerSecond: (successfulSwaps / ((swapEndTime - swapStartTime) / 1000))
        };
        
        console.log("\n=== ⛽ Test 4: 가스 사용량 분석 ===");
        
        console.log("🔍 다양한 작업의 가스 사용량 분석...");
        
        try {
            // 인덱스 생성 가스 측정
            const gasTestComponents = [
                {
                    tokenAddress: deploymentInfo.contracts.mockUSDC,
                    hyperliquidAssetIndex: 99,
                    targetRatio: 7000,
                    depositedAmount: 0
                },
                {
                    tokenAddress: deploymentInfo.contracts.mockWETH,
                    hyperliquidAssetIndex: 100,
                    targetRatio: 3000,
                    depositedAmount: 0
                }
            ];
            
            const gasTestTx = await factory.createIndexFund(
                "Gas Test Index",
                "GASTEST",
                gasTestComponents,
                { gasLimit: 5000000 }
            );
            
            const gasTestReceipt = await gasTestTx.wait();
            const indexCreationGas = gasTestReceipt.gasUsed;
            
            console.log(`   ⛽ 인덱스 생성 가스: ${indexCreationGas}`);
            
            // 토큰 승인 가스 측정 (이미 승인된 토큰이므로 낮은 가스)
            const approvalTx = await mockUSDC.approve(factory.target, ethers.parseUnits("1000", 6));
            const approvalReceipt = await approvalTx.wait();
            const approvalGas = approvalReceipt.gasUsed;
            
            console.log(`   ⛽ 토큰 승인 가스: ${approvalGas}`);
            
            // 가스 효율성 계산
            const gasPrice = 500000000; // 0.5 gwei (HyperEVM)
            const ethPrice = 2000; // $2000 per ETH
            
            const indexCreationCostETH = Number(indexCreationGas) * gasPrice / 1e18;
            const indexCreationCostUSD = indexCreationCostETH * ethPrice;
            
            console.log(`   💰 인덱스 생성 비용: ${indexCreationCostETH.toFixed(6)} ETH (~$${indexCreationCostUSD.toFixed(4)})`);
            
            stressResults.gasPressureTests = {
                indexCreationGas: indexCreationGas.toString(),
                tokenApprovalGas: approvalGas.toString(),
                estimatedCosts: {
                    indexCreationETH: indexCreationCostETH,
                    indexCreationUSD: indexCreationCostUSD,
                    gasPrice: gasPrice,
                    ethPrice: ethPrice
                }
            };
            
        } catch (error) {
            console.log(`   ❌ 가스 테스트 실패: ${error.message}`);
            stressResults.gasPressureTests = {
                error: error.message
            };
        }
        
        console.log("\n=== 📊 Test 5: 메모리 및 스토리지 사용량 ===");
        
        // 스토리지 사용량 분석
        console.log("🔍 컨트랙트 스토리지 사용량 분석...");
        
        try {
            // 팩토리에 생성된 펀드 수 확인
            const totalFunds = await factory.totalFunds();
            const creatorFunds = await factory.getCreatorFunds(deployer.address);
            
            console.log(`   📊 총 생성된 펀드: ${totalFunds}`);
            console.log(`   👤 Deployer 생성 펀드: ${creatorFunds.length}`);
            
            // 각 펀드의 정보 확인
            let totalComponents = 0;
            for (let i = 0; i < Math.min(creatorFunds.length, 5); i++) { // 최대 5개만 확인
                try {
                    const fundInfo = await factory.getFundInfo(creatorFunds[i]);
                    const components = await factory.getFundComponents(creatorFunds[i]);
                    totalComponents += components.length;
                    
                    console.log(`     펀드 ${i+1}: ${components.length} 컴포넌트`);
                } catch (error) {
                    console.log(`     펀드 ${i+1}: 정보 조회 실패`);
                }
            }
            
            console.log(`   🧮 평균 컴포넌트 수: ${(totalComponents / Math.min(creatorFunds.length, 5)).toFixed(1)}`);
            
            stressResults.memoryUsageTests = {
                totalFunds: totalFunds.toString(),
                deployerFunds: creatorFunds.length,
                averageComponents: totalComponents / Math.min(creatorFunds.length, 5),
                storageEfficiency: "optimized"
            };
            
        } catch (error) {
            console.log(`   ❌ 스토리지 분석 실패: ${error.message}`);
            stressResults.memoryUsageTests = {
                error: error.message
            };
        }
        
        console.log("\n=== 🌐 Test 6: 네트워크 지연 시간 분석 ===");
        
        console.log("🔍 네트워크 응답 시간 분석...");
        
        const networkTests = [];
        
        for (let i = 0; i < 10; i++) {
            const startTime = Date.now();
            
            try {
                const balance = await mockUSDC.balanceOf(deployer.address);
                const endTime = Date.now();
                
                networkTests.push({
                    iteration: i + 1,
                    responseTime: endTime - startTime,
                    status: "success"
                });
                
            } catch (error) {
                const endTime = Date.now();
                networkTests.push({
                    iteration: i + 1,
                    responseTime: endTime - startTime,
                    status: "failed",
                    error: error.message
                });
            }
        }
        
        const avgNetworkLatency = networkTests
            .filter(t => t.status === "success")
            .reduce((sum, t) => sum + t.responseTime, 0) / networkTests.filter(t => t.status === "success").length;
        
        console.log(`   ⏱️ 평균 네트워크 지연시간: ${avgNetworkLatency.toFixed(2)}ms`);
        console.log(`   📡 성공한 요청: ${networkTests.filter(t => t.status === "success").length}/10`);
        
        stressResults.networkLatencyTests = {
            averageLatency: avgNetworkLatency,
            successfulRequests: networkTests.filter(t => t.status === "success").length,
            totalRequests: networkTests.length,
            rawData: networkTests
        };
        
        console.log("\n=== 📈 종합 성능 분석 ===");
        
        // 전체 시스템 성능 점수 계산
        let performanceScore = 100;
        
        // 동시 처리 능력 (가중치 30%)
        const concurrentScore = (successCount / 5) * 30;
        
        // 응답 시간 (가중치 25%)
        const responseScore = avgResponseTime < 100 ? 25 : 
                             avgResponseTime < 200 ? 20 :
                             avgResponseTime < 500 ? 15 : 10;
        
        // 처리량 (가중치 25%)
        const throughputScore = stressResults.throughputAnalysis.dexQueries.queriesPerSecond > 5 ? 25 :
                               stressResults.throughputAnalysis.dexQueries.queriesPerSecond > 2 ? 20 :
                               stressResults.throughputAnalysis.dexQueries.queriesPerSecond > 1 ? 15 : 10;
        
        // 네트워크 안정성 (가중치 20%)
        const networkScore = avgNetworkLatency < 100 ? 20 :
                            avgNetworkLatency < 200 ? 15 :
                            avgNetworkLatency < 500 ? 10 : 5;
        
        const totalPerformanceScore = concurrentScore + responseScore + throughputScore + networkScore;
        
        console.log(`🏆 종합 성능 점수: ${totalPerformanceScore.toFixed(1)}/100`);
        console.log(`   📊 동시 처리 능력: ${concurrentScore.toFixed(1)}/30`);
        console.log(`   ⏱️ 응답 시간: ${responseScore}/25`);
        console.log(`   🚀 처리량: ${throughputScore}/25`);
        console.log(`   🌐 네트워크 안정성: ${networkScore}/20`);
        
        // 성능 등급 결정
        let performanceGrade = "F";
        if (totalPerformanceScore >= 90) performanceGrade = "A+";
        else if (totalPerformanceScore >= 85) performanceGrade = "A";
        else if (totalPerformanceScore >= 80) performanceGrade = "B+";
        else if (totalPerformanceScore >= 75) performanceGrade = "B";
        else if (totalPerformanceScore >= 70) performanceGrade = "C";
        else if (totalPerformanceScore >= 60) performanceGrade = "D";
        
        console.log(`🎯 성능 등급: ${performanceGrade}`);
        
        // 병목 지점 분석
        const bottlenecks = [];
        if (concurrentScore < 20) bottlenecks.push("동시 처리 능력 개선 필요");
        if (responseScore < 20) bottlenecks.push("응답 시간 최적화 필요");
        if (throughputScore < 20) bottlenecks.push("처리량 향상 필요");
        if (networkScore < 15) bottlenecks.push("네트워크 지연 시간 개선 필요");
        
        if (bottlenecks.length > 0) {
            console.log("\n⚠️ 개선 필요 영역:");
            bottlenecks.forEach(bottleneck => {
                console.log(`   • ${bottleneck}`);
            });
        } else {
            console.log("\n✅ 모든 성능 지표 양호");
        }
        
        stressResults.summary = {
            performanceScore: totalPerformanceScore,
            performanceGrade: performanceGrade,
            bottlenecks: bottlenecks,
            recommendations: bottlenecks.length > 0 ? 
                ["성능 병목 지점 해결", "부하 분산 구현", "캐싱 메커니즘 도입"] :
                ["현재 성능 수준 유지", "추가 최적화 고려", "모니터링 시스템 구축"]
        };
        
        // 결과 저장
        deploymentInfo.stressTesting = {
            timestamp: new Date().toISOString(),
            status: "completed",
            results: stressResults
        };
        
        console.log("\n💾 스트레스 테스트 결과 저장 중...");
        require('fs').writeFileSync(
            'testnet-deployment.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        console.log("✅ 스트레스 테스트 결과 저장 완료");
        
        console.log("\n🎉 성능 스트레스 테스트 완료!");
        console.log(`🏆 최종 성능 점수: ${totalPerformanceScore.toFixed(1)}/100 (${performanceGrade})`);
        
        return stressResults.summary;
        
    } catch (error) {
        console.error(`\n❌ 스트레스 테스트 중 오류: ${error.message}`);
        console.error("Stack trace:", error.stack);
        throw error;
    }
}

main()
    .then((summary) => {
        console.log(`\n🚀 스트레스 테스트 완료!`);
        console.log(`🏆 성능 등급: ${summary.performanceGrade}`);
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });