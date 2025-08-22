// test-economic-attacks.js
/**
 * 심화 경제적 공격 벡터 분석
 * MEV, Sandwich Attack, Flash Loan Attack 시뮬레이션
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("💰 HyperIndex 경제적 공격 벡터 심화 분석");
    console.log("=====================================");
    console.log("🎯 MEV, Sandwich, Flash Loan 공격 시뮬레이션");
    
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
    
    const economicAttackResults = {
        mevAnalysis: [],
        sandwichAttacks: [],
        flashLoanAttacks: [],
        arbitrageOpportunities: [],
        frontRunningVulnerabilities: [],
        priceManipulationTests: [],
        summary: {}
    };
    
    try {
        console.log("\n=== 🚀 Test 1: MEV (Maximal Extractable Value) 분석 ===");
        
        // Get contract instances
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = IndexTokenFactory.attach(deploymentInfo.contracts.factory);
        
        const MockDEXAggregator = await ethers.getContractFactory("MockDEXAggregator");
        const dexAggregator = MockDEXAggregator.attach(deploymentInfo.contracts.mockDEXAggregator);
        
        const mockUSDC = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockUSDC);
        const mockWETH = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockWETH);
        
        console.log("🔍 1-1: 프론트러닝 기회 분석");
        
        // 큰 규모의 스왑 시뮬레이션으로 MEV 기회 탐색
        const largeSwapAmounts = [
            ethers.parseUnits("10000", 6),  // 10K USDC
            ethers.parseUnits("50000", 6),  // 50K USDC
            ethers.parseUnits("100000", 6)  // 100K USDC
        ];
        
        for (let i = 0; i < largeSwapAmounts.length; i++) {
            try {
                console.log(`   🔍 ${ethers.formatUnits(largeSwapAmounts[i], 6)} USDC 스왑 분석...`);
                
                // 스왑 전 가격
                const preSwapQuote = await dexAggregator.getQuote(
                    deploymentInfo.contracts.mockUSDC,
                    deploymentInfo.contracts.mockWETH,
                    ethers.parseUnits("1000", 6) // 표준 1K USDC
                );
                
                // 대량 스왑 영향 분석
                const largeSwapQuote = await dexAggregator.getQuote(
                    deploymentInfo.contracts.mockUSDC,
                    deploymentInfo.contracts.mockWETH,
                    largeSwapAmounts[i]
                );
                
                // 스왑 후 예상 가격 (시뮬레이션)
                const postSwapQuote = await dexAggregator.getQuote(
                    deploymentInfo.contracts.mockUSDC,
                    deploymentInfo.contracts.mockWETH,
                    ethers.parseUnits("1000", 6)
                );
                
                const priceImpact = ((Number(postSwapQuote.returnAmount) - Number(preSwapQuote.returnAmount)) / Number(preSwapQuote.returnAmount)) * 100;
                const potentialMEV = Math.abs(priceImpact) * Number(ethers.formatUnits(largeSwapAmounts[i], 6)) / 100;
                
                console.log(`     💱 가격 영향: ${priceImpact.toFixed(4)}%`);
                console.log(`     💰 잠재적 MEV: $${potentialMEV.toFixed(2)}`);
                
                economicAttackResults.mevAnalysis.push({
                    swapSize: ethers.formatUnits(largeSwapAmounts[i], 6),
                    priceImpact: priceImpact,
                    potentialMEV: potentialMEV,
                    frontRunningRisk: potentialMEV > 100 ? "HIGH" : potentialMEV > 50 ? "MEDIUM" : "LOW"
                });
                
            } catch (error) {
                console.log(`     ❌ 분석 실패: ${error.message}`);
                economicAttackResults.mevAnalysis.push({
                    swapSize: ethers.formatUnits(largeSwapAmounts[i], 6),
                    error: error.message
                });
            }
        }
        
        console.log("\n🥪 Test 2: Sandwich Attack 시뮬레이션");
        
        console.log("🔍 2-1: 샌드위치 공격 시나리오 분석");
        
        try {
            // 피해자의 중간 규모 스왑 시뮬레이션
            const victimSwapAmount = ethers.parseUnits("5000", 6); // 5K USDC
            
            console.log("   📊 샌드위치 공격 3단계 시뮬레이션:");
            
            // 1단계: 공격자의 Front-run 스왑
            console.log("     1️⃣ Front-run: 공격자가 먼저 대량 구매");
            const frontRunAmount = ethers.parseUnits("20000", 6); // 20K USDC
            const frontRunQuote = await dexAggregator.getQuote(
                deploymentInfo.contracts.mockUSDC,
                deploymentInfo.contracts.mockWETH,
                frontRunAmount
            );
            
            console.log(`       🔹 공격자 구매: ${ethers.formatUnits(frontRunAmount, 6)} USDC → ${ethers.formatEther(frontRunQuote.returnAmount)} WETH`);
            
            // 2단계: 피해자의 스왑 (가격 상승 후)
            console.log("     2️⃣ Victim: 피해자의 스왑 (불리한 가격)");
            const victimQuote = await dexAggregator.getQuote(
                deploymentInfo.contracts.mockUSDC,
                deploymentInfo.contracts.mockWETH,
                victimSwapAmount
            );
            
            console.log(`       🔸 피해자 스왑: ${ethers.formatUnits(victimSwapAmount, 6)} USDC → ${ethers.formatEther(victimQuote.returnAmount)} WETH`);
            
            // 3단계: 공격자의 Back-run 스왑
            console.log("     3️⃣ Back-run: 공격자가 이익 실현");
            const backRunQuote = await dexAggregator.getQuote(
                deploymentInfo.contracts.mockWETH,
                deploymentInfo.contracts.mockUSDC,
                frontRunQuote.returnAmount
            );
            
            console.log(`       🔹 공격자 판매: ${ethers.formatEther(frontRunQuote.returnAmount)} WETH → ${ethers.formatUnits(backRunQuote.returnAmount, 6)} USDC`);
            
            // 이익 계산
            const attackerProfit = Number(ethers.formatUnits(backRunQuote.returnAmount, 6)) - Number(ethers.formatUnits(frontRunAmount, 6));
            const victimLoss = attackerProfit; // 제로섬 게임에서 근사치
            
            console.log(`     💰 공격자 이익: $${attackerProfit.toFixed(2)}`);
            console.log(`     💸 피해자 손실: $${victimLoss.toFixed(2)}`);
            
            economicAttackResults.sandwichAttacks.push({
                victimSwapSize: ethers.formatUnits(victimSwapAmount, 6),
                attackerFrontRun: ethers.formatUnits(frontRunAmount, 6),
                attackerProfit: attackerProfit,
                victimLoss: victimLoss,
                attackFeasibility: attackerProfit > 50 ? "PROFITABLE" : "MARGINAL",
                defenseRecommendation: attackerProfit > 50 ? "Implement slippage protection" : "Current protection adequate"
            });
            
        } catch (error) {
            console.log(`   ❌ 샌드위치 공격 분석 실패: ${error.message}`);
            economicAttackResults.sandwichAttacks.push({
                error: error.message
            });
        }
        
        console.log("\n⚡ Test 3: Flash Loan Attack 시뮬레이션");
        
        console.log("🔍 3-1: 플래시론 공격 시나리오");
        
        try {
            // 플래시론으로 대량 자금 확보 시뮬레이션
            const flashLoanAmount = ethers.parseUnits("1000000", 6); // 1M USDC 플래시론
            
            console.log(`   💫 플래시론 시뮬레이션: ${ethers.formatUnits(flashLoanAmount, 6)} USDC`);
            
            // 플래시론 자금으로 가능한 공격 시나리오
            console.log("     📊 공격 시나리오 분석:");
            
            // 시나리오 1: 가격 조작을 통한 차익거래
            console.log("     🎯 시나리오 1: 가격 조작 차익거래");
            
            const manipulationQuote = await dexAggregator.getQuote(
                deploymentInfo.contracts.mockUSDC,
                deploymentInfo.contracts.mockWETH,
                flashLoanAmount
            );
            
            // 조작된 가격으로 역 스왑
            const reverseQuote = await dexAggregator.getQuote(
                deploymentInfo.contracts.mockWETH,
                deploymentInfo.contracts.mockUSDC,
                manipulationQuote.returnAmount
            );
            
            const manipulationProfit = Number(ethers.formatUnits(reverseQuote.returnAmount, 6)) - Number(ethers.formatUnits(flashLoanAmount, 6));
            const flashLoanFee = Number(ethers.formatUnits(flashLoanAmount, 6)) * 0.0009; // 0.09% 수수료
            const netProfit = manipulationProfit - flashLoanFee;
            
            console.log(`       💰 조작 이익: $${manipulationProfit.toFixed(2)}`);
            console.log(`       💸 플래시론 수수료: $${flashLoanFee.toFixed(2)}`);
            console.log(`       📊 순이익: $${netProfit.toFixed(2)}`);
            
            // 시나리오 2: 인덱스 펀드 조작
            console.log("     🎯 시나리오 2: 인덱스 펀드 NAV 조작");
            
            // 대량 예치로 NAV 조작 시도
            const navManipulationPotential = Number(ethers.formatUnits(flashLoanAmount, 6)) * 0.001; // 0.1% 조작 가능성
            
            console.log(`       📈 NAV 조작 잠재력: $${navManipulationPotential.toFixed(2)}`);
            
            economicAttackResults.flashLoanAttacks.push({
                flashLoanAmount: ethers.formatUnits(flashLoanAmount, 6),
                priceManipulationProfit: manipulationProfit,
                flashLoanFee: flashLoanFee,
                netProfit: netProfit,
                navManipulationPotential: navManipulationPotential,
                attackViability: netProfit > 0 ? "VIABLE" : "NOT_VIABLE",
                riskLevel: netProfit > 1000 ? "HIGH" : netProfit > 100 ? "MEDIUM" : "LOW"
            });
            
        } catch (error) {
            console.log(`   ❌ 플래시론 공격 분석 실패: ${error.message}`);
            economicAttackResults.flashLoanAttacks.push({
                error: error.message
            });
        }
        
        console.log("\n📊 Test 4: 차익거래 기회 분석");
        
        console.log("🔍 4-1: 프로토콜 간 가격 차이 분석");
        
        try {
            // 여러 프로토콜에서의 가격 비교 시뮬레이션
            const arbitrageAmount = ethers.parseUnits("10000", 6); // 10K USDC
            
            // 프로토콜별 가격 시뮬레이션 (Mock이므로 인위적 차이 생성)
            const protocols = [
                { name: "UniswapV3", priceMultiplier: 1.0 },
                { name: "SushiSwap", priceMultiplier: 1.002 }, // 0.2% 차이
                { name: "PancakeSwap", priceMultiplier: 0.998 }, // -0.2% 차이
                { name: "Curve", priceMultiplier: 1.001 } // 0.1% 차이
            ];
            
            console.log("     💱 프로토콜별 가격 분석:");
            
            const baseQuote = await dexAggregator.getQuote(
                deploymentInfo.contracts.mockUSDC,
                deploymentInfo.contracts.mockWETH,
                arbitrageAmount
            );
            
            const protocolPrices = [];
            
            for (const protocol of protocols) {
                const adjustedReturn = Number(baseQuote.returnAmount) * protocol.priceMultiplier;
                const price = Number(ethers.formatUnits(arbitrageAmount, 6)) / Number(ethers.formatEther(adjustedReturn.toString()));
                
                protocolPrices.push({
                    protocol: protocol.name,
                    price: price,
                    returnAmount: adjustedReturn
                });
                
                console.log(`       ${protocol.name}: $${price.toFixed(2)} per WETH`);
            }
            
            // 최고가와 최저가 차이로 차익거래 기회 계산
            const maxPrice = Math.max(...protocolPrices.map(p => p.price));
            const minPrice = Math.min(...protocolPrices.map(p => p.price));
            const arbitrageOpportunity = (maxPrice - minPrice) / minPrice * 100;
            const potentialProfit = arbitrageOpportunity * Number(ethers.formatUnits(arbitrageAmount, 6)) / 100;
            
            console.log(`     📊 최대 가격 차이: ${arbitrageOpportunity.toFixed(4)}%`);
            console.log(`     💰 잠재적 차익거래 이익: $${potentialProfit.toFixed(2)}`);
            
            economicAttackResults.arbitrageOpportunities.push({
                testAmount: ethers.formatUnits(arbitrageAmount, 6),
                maxPriceDifference: arbitrageOpportunity,
                potentialProfit: potentialProfit,
                protocolPrices: protocolPrices,
                arbitrageViability: potentialProfit > 50 ? "PROFITABLE" : "MARGINAL"
            });
            
        } catch (error) {
            console.log(`   ❌ 차익거래 분석 실패: ${error.message}`);
            economicAttackResults.arbitrageOpportunities.push({
                error: error.message
            });
        }
        
        console.log("\n🎯 Test 5: 가격 조작 취약점 분석");
        
        console.log("🔍 5-1: Oracle 조작 가능성 분석");
        
        try {
            const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
            const priceFeed = MockPriceFeed.attach(deploymentInfo.contracts.mockPriceFeed);
            
            // 현재 가격 확인
            const currentPrices = [];
            for (let i = 0; i < 3; i++) {
                try {
                    const price = await priceFeed.getPrice(i);
                    currentPrices.push({
                        assetIndex: i,
                        price: ethers.formatEther(price)
                    });
                    console.log(`     Asset ${i}: $${ethers.formatEther(price)}`);
                } catch (error) {
                    console.log(`     Asset ${i}: 가격 조회 실패`);
                }
            }
            
            // 가격 조작 시도 (권한 확인)
            console.log("     🔍 가격 조작 시도...");
            
            try {
                await priceFeed.updatePrice(0, ethers.parseEther("999999")); // 극단적 가격 설정
                
                console.log("     🚨 CRITICAL: 가격 조작 성공!");
                economicAttackResults.priceManipulationTests.push({
                    manipulationType: "direct_oracle_manipulation",
                    success: true,
                    severity: "CRITICAL",
                    impact: "Complete price feed compromise",
                    recommendation: "Implement proper access controls on price updates"
                });
                
            } catch (error) {
                console.log("     ✅ 가격 조작 방어됨");
                economicAttackResults.priceManipulationTests.push({
                    manipulationType: "direct_oracle_manipulation",
                    success: false,
                    protection: "Access control working",
                    error: error.message
                });
            }
            
        } catch (error) {
            console.log(`   ❌ Oracle 분석 실패: ${error.message}`);
            economicAttackResults.priceManipulationTests.push({
                error: error.message
            });
        }
        
        console.log("\n=== 📊 경제적 공격 위험도 평가 ===");
        
        // 위험도 점수 계산
        let riskScore = 0;
        let totalIssues = 0;
        
        // MEV 위험도
        const highMEVCount = economicAttackResults.mevAnalysis.filter(m => m.frontRunningRisk === "HIGH").length;
        const mediumMEVCount = economicAttackResults.mevAnalysis.filter(m => m.frontRunningRisk === "MEDIUM").length;
        riskScore += highMEVCount * 20 + mediumMEVCount * 10;
        totalIssues += highMEVCount + mediumMEVCount;
        
        // Sandwich Attack 위험도
        const profitableSandwich = economicAttackResults.sandwichAttacks.filter(s => s.attackFeasibility === "PROFITABLE").length;
        riskScore += profitableSandwich * 25;
        totalIssues += profitableSandwich;
        
        // Flash Loan 위험도
        const viableFlashLoan = economicAttackResults.flashLoanAttacks.filter(f => f.attackViability === "VIABLE").length;
        riskScore += viableFlashLoan * 30;
        totalIssues += viableFlashLoan;
        
        // Price Manipulation 위험도
        const successfulManipulation = economicAttackResults.priceManipulationTests.filter(p => p.success === true).length;
        riskScore += successfulManipulation * 40;
        totalIssues += successfulManipulation;
        
        console.log(`💀 총 위험도 점수: ${riskScore}/100`);
        console.log(`📊 발견된 취약점: ${totalIssues}개`);
        
        // 위험도 등급
        let riskGrade = "LOW";
        if (riskScore >= 80) riskGrade = "CRITICAL";
        else if (riskScore >= 60) riskGrade = "HIGH";
        else if (riskScore >= 40) riskGrade = "MEDIUM";
        
        console.log(`🚨 위험도 등급: ${riskGrade}`);
        
        // 세부 위험 분석
        console.log("\n🔍 세부 위험 분석:");
        console.log(`   🚀 MEV 위험: ${highMEVCount + mediumMEVCount > 0 ? "존재" : "낮음"}`);
        console.log(`   🥪 Sandwich 공격 위험: ${profitableSandwich > 0 ? "높음" : "낮음"}`);
        console.log(`   ⚡ Flash Loan 공격 위험: ${viableFlashLoan > 0 ? "높음" : "낮음"}`);
        console.log(`   📊 가격 조작 위험: ${successfulManipulation > 0 ? "치명적" : "낮음"}`);
        
        // 권장 보안 조치
        const securityRecommendations = [];
        
        if (highMEVCount > 0) {
            securityRecommendations.push("MEV 보호: 배치 처리 및 지연 실행 구현");
        }
        if (profitableSandwich > 0) {
            securityRecommendations.push("Sandwich 보호: 슬리피지 한도 및 최대 프론트런 시간 설정");
        }
        if (viableFlashLoan > 0) {
            securityRecommendations.push("Flash Loan 보호: 단일 블록 대량 거래 제한");
        }
        if (successfulManipulation > 0) {
            securityRecommendations.push("Oracle 보호: 다중 소스 가격 피드 및 권한 제어 강화");
        }
        
        if (securityRecommendations.length === 0) {
            securityRecommendations.push("현재 보안 수준 양호 - 지속적 모니터링 권장");
        }
        
        console.log("\n💡 권장 보안 조치:");
        securityRecommendations.forEach(rec => {
            console.log(`   • ${rec}`);
        });
        
        economicAttackResults.summary = {
            riskScore: riskScore,
            riskGrade: riskGrade,
            totalVulnerabilities: totalIssues,
            mevRisk: highMEVCount + mediumMEVCount,
            sandwichRisk: profitableSandwich,
            flashLoanRisk: viableFlashLoan,
            priceManipulationRisk: successfulManipulation,
            securityRecommendations: securityRecommendations
        };
        
        // 결과 저장
        deploymentInfo.economicAttackAnalysis = {
            timestamp: new Date().toISOString(),
            status: "completed",
            results: economicAttackResults
        };
        
        console.log("\n💾 경제적 공격 분석 결과 저장 중...");
        require('fs').writeFileSync(
            'testnet-deployment.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        console.log("✅ 경제적 공격 분석 결과 저장 완료");
        
        console.log("\n🎉 경제적 공격 벡터 분석 완료!");
        console.log(`🚨 최종 위험도: ${riskScore}/100 (${riskGrade})`);
        
        return economicAttackResults.summary;
        
    } catch (error) {
        console.error(`\n❌ 경제적 공격 분석 중 오류: ${error.message}`);
        console.error("Stack trace:", error.stack);
        throw error;
    }
}

main()
    .then((summary) => {
        console.log(`\n🚀 경제적 공격 분석 완료!`);
        console.log(`🚨 위험도 등급: ${summary.riskGrade}`);
        console.log(`📊 발견된 취약점: ${summary.totalVulnerabilities}개`);
        process.exit(0);
    })
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });