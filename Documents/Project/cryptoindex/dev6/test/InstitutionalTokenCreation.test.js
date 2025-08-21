const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Institutional Token Creation Test", function () {
    // 기관별 토큰 생성 시나리오를 테스트하는 픽스처
    async function deployInstitutionalTestFixture() {
        const [owner, kbankInstitution, nhInstitution, platformAdmin, user1, user2] = await ethers.getSigners();
        
        // Mock tokens 배포 (실제 암호화폐 대신)
        const MockToken = await ethers.getContractFactory("MockERC20");
        
        // K-Bank가 요청할 "K-Crypto Top 4" 구성 토큰들
        const btc = await MockToken.deploy("Bitcoin", "BTC", 18);
        const eth = await MockToken.deploy("Ethereum", "ETH", 18);
        const usdc = await MockToken.deploy("USD Coin", "USDC", 6);
        const sol = await MockToken.deploy("Solana", "SOL", 9);
        
        // NH 투자증권이 요청할 "NH-AI Innovation" 구성 토큰들
        const ada = await MockToken.deploy("Cardano", "ADA", 6);
        const dot = await MockToken.deploy("Polkadot", "DOT", 10);
        const matic = await MockToken.deploy("Polygon", "MATIC", 18);
        
        await Promise.all([btc.deployed(), eth.deployed(), usdc.deployed(), sol.deployed(), 
                          ada.deployed(), dot.deployed(), matic.deployed()]);
        
        // IndexTokenFactory 배포
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = await IndexTokenFactory.deploy(owner.address);
        await factory.deployed();
        
        // 토큰들 승인
        const tokensToAuthorize = [btc, eth, usdc, sol, ada, dot, matic];
        for (const token of tokensToAuthorize) {
            await factory.authorizeToken(token.address, true);
        }
        
        // 기관들에게 recipe creator 권한 부여
        const RECIPE_CREATOR_ROLE = await factory.RECIPE_CREATOR_ROLE();
        await factory.grantRole(RECIPE_CREATOR_ROLE, kbankInstitution.address);
        await factory.grantRole(RECIPE_CREATOR_ROLE, nhInstitution.address);
        
        // 기관들에게 충분한 토큰 민팅 (실제로는 해당 토큰들을 보유해야 함)
        const mintAmount = ethers.utils.parseEther("10000");
        const usdcAmount = ethers.utils.parseUnits("1000000", 6); // 1M USDC
        const solAmount = ethers.utils.parseUnits("100000", 9); // 100K SOL
        const adaAmount = ethers.utils.parseUnits("500000", 6); // 500K ADA
        const dotAmount = ethers.utils.parseUnits("50000", 10); // 50K DOT
        
        // K-Bank에 토큰 제공
        await btc.mint(kbankInstitution.address, mintAmount);
        await eth.mint(kbankInstitution.address, mintAmount);
        await usdc.mint(kbankInstitution.address, usdcAmount);
        await sol.mint(kbankInstitution.address, solAmount);
        
        // NH 투자증권에 토큰 제공
        await eth.mint(nhInstitution.address, mintAmount);
        await ada.mint(nhInstitution.address, adaAmount);
        await dot.mint(nhInstitution.address, dotAmount);
        await matic.mint(nhInstitution.address, mintAmount);
        
        return {
            factory,
            tokens: {
                btc, eth, usdc, sol, ada, dot, matic
            },
            accounts: {
                owner, kbankInstitution, nhInstitution, platformAdmin, user1, user2
            }
        };
    }
    
    describe("K-Bank: K-Crypto Top 4 Index 생성", function () {
        it("K-Bank가 K-Crypto Top 4 인덱스 펀드를 생성해야 함", async function () {
            const { factory, tokens, accounts } = await loadFixture(deployInstitutionalTestFixture);
            const { btc, eth, usdc, sol } = tokens;
            const { kbankInstitution } = accounts;
            
            // K-Bank의 K-Crypto Top 4 구성 비율
            const kCryptoComponents = [
                {
                    tokenAddress: btc.address,
                    hyperliquidAssetIndex: 1, // BTC
                    targetRatio: 4000, // 40%
                    depositedAmount: 0
                },
                {
                    tokenAddress: eth.address,
                    hyperliquidAssetIndex: 2, // ETH
                    targetRatio: 3000, // 30%
                    depositedAmount: 0
                },
                {
                    tokenAddress: usdc.address,
                    hyperliquidAssetIndex: 0, // USDC (stable)
                    targetRatio: 2000, // 20%
                    depositedAmount: 0
                },
                {
                    tokenAddress: sol.address,
                    hyperliquidAssetIndex: 3, // SOL
                    targetRatio: 1000, // 10%
                    depositedAmount: 0
                }
            ];
            
            console.log("🏦 K-Bank가 K-Crypto Top 4 인덱스 펀드 생성 요청...");
            
            const tx = await factory.connect(kbankInstitution).createIndexFund(
                "K-Crypto Top 4 Index",
                "KTOP4",
                kCryptoComponents
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "FundCreated");
            
            expect(event).to.not.be.undefined;
            expect(event.args.name).to.equal("K-Crypto Top 4 Index");
            expect(event.args.creator).to.equal(kbankInstitution.address);
            
            const fundId = event.args.fundId;
            console.log(`✅ 펀드 생성 완료 - Fund ID: ${fundId}`);
            
            // 펀드 정보 확인
            const fundInfo = await factory.getFundInfo(fundId);
            expect(fundInfo.name).to.equal("K-Crypto Top 4 Index");
            expect(fundInfo.symbol).to.equal("KTOP4");
            expect(fundInfo.creator).to.equal(kbankInstitution.address);
            expect(fundInfo.isActive).to.be.true;
            expect(fundInfo.isIssued).to.be.false;
            
            // 구성 요소 확인
            const components = await factory.getFundComponents(fundId);
            expect(components.length).to.equal(4);
            expect(components[0].targetRatio).to.equal(4000); // BTC 40%
            expect(components[1].targetRatio).to.equal(3000); // ETH 30%
            expect(components[2].targetRatio).to.equal(2000); // USDC 20%
            expect(components[3].targetRatio).to.equal(1000); // SOL 10%
            
            console.log("📊 K-Crypto Top 4 구성:");
            console.log(`  - BTC: ${components[0].targetRatio / 100}%`);
            console.log(`  - ETH: ${components[1].targetRatio / 100}%`);
            console.log(`  - USDC: ${components[2].targetRatio / 100}%`);
            console.log(`  - SOL: ${components[3].targetRatio / 100}%`);
            
            this.kCryptoFundId = fundId;
        });
        
        it("K-Bank가 구성 토큰들을 예치해야 함", async function () {
            const { factory, tokens, accounts } = await loadFixture(deployInstitutionalTestFixture);
            const { btc, eth, usdc, sol } = tokens;
            const { kbankInstitution } = accounts;
            
            // 먼저 펀드 생성
            const kCryptoComponents = [
                { tokenAddress: btc.address, hyperliquidAssetIndex: 1, targetRatio: 4000, depositedAmount: 0 },
                { tokenAddress: eth.address, hyperliquidAssetIndex: 2, targetRatio: 3000, depositedAmount: 0 },
                { tokenAddress: usdc.address, hyperliquidAssetIndex: 0, targetRatio: 2000, depositedAmount: 0 },
                { tokenAddress: sol.address, hyperliquidAssetIndex: 3, targetRatio: 1000, depositedAmount: 0 }
            ];
            
            const tx = await factory.connect(kbankInstitution).createIndexFund(
                "K-Crypto Top 4 Index", "KTOP4", kCryptoComponents
            );
            const receipt = await tx.wait();
            const fundId = receipt.events.find(e => e.event === "FundCreated").args.fundId;
            
            console.log("💰 K-Bank가 구성 토큰들 예치 중...");
            
            // 예치할 토큰 수량 (비율에 맞춰 계산)
            const depositAmounts = {
                btc: ethers.utils.parseEther("40"), // $40k worth (assuming $1k per BTC)
                eth: ethers.utils.parseEther("300"), // $30k worth (assuming $100 per ETH)
                usdc: ethers.utils.parseUnits("20000", 6), // $20k worth
                sol: ethers.utils.parseUnits("10000", 9) // $10k worth (assuming $1 per SOL)
            };
            
            // 토큰 승인
            await btc.connect(kbankInstitution).approve(factory.address, depositAmounts.btc);
            await eth.connect(kbankInstitution).approve(factory.address, depositAmounts.eth);
            await usdc.connect(kbankInstitution).approve(factory.address, depositAmounts.usdc);
            await sol.connect(kbankInstitution).approve(factory.address, depositAmounts.sol);
            
            // 토글 예치 (배치로 처리)
            await expect(
                factory.connect(kbankInstitution).depositComponentTokens(
                    fundId,
                    [btc.address, eth.address, usdc.address, sol.address],
                    [depositAmounts.btc, depositAmounts.eth, depositAmounts.usdc, depositAmounts.sol]
                )
            ).to.emit(factory, "TokensDeposited");
            
            // 예치 확인
            const components = await factory.getFundComponents(fundId);
            expect(components[0].depositedAmount).to.equal(depositAmounts.btc);
            expect(components[1].depositedAmount).to.equal(depositAmounts.eth);
            expect(components[2].depositedAmount).to.equal(depositAmounts.usdc);
            expect(components[3].depositedAmount).to.equal(depositAmounts.sol);
            
            console.log("✅ 토큰 예치 완료:");
            console.log(`  - BTC: ${ethers.utils.formatEther(components[0].depositedAmount)} BTC`);
            console.log(`  - ETH: ${ethers.utils.formatEther(components[1].depositedAmount)} ETH`);
            console.log(`  - USDC: ${ethers.utils.formatUnits(components[2].depositedAmount, 6)} USDC`);
            console.log(`  - SOL: ${ethers.utils.formatUnits(components[3].depositedAmount, 9)} SOL`);
        });
    });
    
    describe("NH 투자증권: NH-AI Innovation Index 생성", function () {
        it("NH 투자증권이 AI/이노베이션 테마 인덱스를 생성해야 함", async function () {
            const { factory, tokens, accounts } = await loadFixture(deployInstitutionalTestFixture);
            const { eth, ada, dot, matic } = tokens;
            const { nhInstitution } = accounts;
            
            // NH 투자증권의 AI Innovation 구성 비율
            const aiInnovationComponents = [
                {
                    tokenAddress: eth.address,
                    hyperliquidAssetIndex: 2, // ETH (스마트 컨트랙트 플랫폼)
                    targetRatio: 5000, // 50%
                    depositedAmount: 0
                },
                {
                    tokenAddress: ada.address,
                    hyperliquidAssetIndex: 4, // ADA (학술적 접근)
                    targetRatio: 2000, // 20%
                    depositedAmount: 0
                },
                {
                    tokenAddress: dot.address,
                    hyperliquidAssetIndex: 5, // DOT (상호운용성)
                    targetRatio: 2000, // 20%
                    depositedAmount: 0
                },
                {
                    tokenAddress: matic.address,
                    hyperliquidAssetIndex: 6, // MATIC (확장성)
                    targetRatio: 1000, // 10%
                    depositedAmount: 0
                }
            ];
            
            console.log("🏛️ NH 투자증권이 NH-AI Innovation 인덱스 펀드 생성 요청...");
            
            const tx = await factory.connect(nhInstitution).createIndexFund(
                "NH-AI Innovation Index",
                "NHAI",
                aiInnovationComponents
            );
            
            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "FundCreated");
            
            expect(event).to.not.be.undefined;
            expect(event.args.name).to.equal("NH-AI Innovation Index");
            expect(event.args.creator).to.equal(nhInstitution.address);
            
            const fundId = event.args.fundId;
            console.log(`✅ 펀드 생성 완료 - Fund ID: ${fundId}`);
            
            // 펀드 정보 확인
            const fundInfo = await factory.getFundInfo(fundId);
            expect(fundInfo.name).to.equal("NH-AI Innovation Index");
            expect(fundInfo.symbol).to.equal("NHAI");
            expect(fundInfo.creator).to.equal(nhInstitution.address);
            
            // 구성 요소 확인
            const components = await factory.getFundComponents(fundId);
            expect(components.length).to.equal(4);
            
            console.log("🤖 NH-AI Innovation 구성:");
            console.log(`  - ETH: ${components[0].targetRatio / 100}% (스마트 컨트랙트)`);
            console.log(`  - ADA: ${components[1].targetRatio / 100}% (학술적 접근)`);
            console.log(`  - DOT: ${components[2].targetRatio / 100}% (상호운용성)`);
            console.log(`  - MATIC: ${components[3].targetRatio / 100}% (확장성)`);
        });
    });
    
    describe("플랫폼 관리자: 토큰 발행", function () {
        it("플랫폼 관리자가 K-Crypto Top 4 인덱스 토큰을 발행해야 함", async function () {
            const { factory, tokens, accounts } = await loadFixture(deployInstitutionalTestFixture);
            const { btc, eth, usdc, sol } = tokens;
            const { kbankInstitution, owner } = accounts;
            
            // 펀드 생성 및 토큰 예치
            const kCryptoComponents = [
                { tokenAddress: btc.address, hyperliquidAssetIndex: 1, targetRatio: 4000, depositedAmount: 0 },
                { tokenAddress: eth.address, hyperliquidAssetIndex: 2, targetRatio: 3000, depositedAmount: 0 },
                { tokenAddress: usdc.address, hyperliquidAssetIndex: 0, targetRatio: 2000, depositedAmount: 0 },
                { tokenAddress: sol.address, hyperliquidAssetIndex: 3, targetRatio: 1000, depositedAmount: 0 }
            ];
            
            const tx = await factory.connect(kbankInstitution).createIndexFund(
                "K-Crypto Top 4 Index", "KTOP4", kCryptoComponents
            );
            const receipt = await tx.wait();
            const fundId = receipt.events.find(e => e.event === "FundCreated").args.fundId;
            
            // 토큰 예치
            const depositAmounts = {
                btc: ethers.utils.parseEther("40"),
                eth: ethers.utils.parseEther("300"),
                usdc: ethers.utils.parseUnits("20000", 6),
                sol: ethers.utils.parseUnits("10000", 9)
            };
            
            await btc.connect(kbankInstitution).approve(factory.address, depositAmounts.btc);
            await eth.connect(kbankInstitution).approve(factory.address, depositAmounts.eth);
            await usdc.connect(kbankInstitution).approve(factory.address, depositAmounts.usdc);
            await sol.connect(kbankInstitution).approve(factory.address, depositAmounts.sol);
            
            await factory.connect(kbankInstitution).depositComponentTokens(
                fundId,
                [btc.address, eth.address, usdc.address, sol.address],
                [depositAmounts.btc, depositAmounts.eth, depositAmounts.usdc, depositAmounts.sol]
            );
            
            console.log("🎯 플랫폼 관리자가 KTOP4 인덱스 토큰 발행 중...");
            
            // 인덱스 토큰 발행 (100,000 KTOP4 토큰)
            const tokenSupply = ethers.utils.parseEther("100000");
            
            const issueTx = await factory.connect(owner).issueIndexToken(fundId, tokenSupply);
            const issueReceipt = await issueTx.wait();
            const issueEvent = issueReceipt.events.find(e => e.event === "IndexTokenIssued");
            
            expect(issueEvent).to.not.be.undefined;
            expect(issueEvent.args.fundId).to.equal(fundId);
            expect(issueEvent.args.tokenSupply).to.equal(tokenSupply);
            
            const indexTokenAddress = issueEvent.args.indexToken;
            console.log(`✅ KTOP4 토큰 발행 완료:`);
            console.log(`  - 토큰 주소: ${indexTokenAddress}`);
            console.log(`  - 발행량: ${ethers.utils.formatEther(tokenSupply)} KTOP4`);
            
            // 펀드 상태 확인
            const fundInfo = await factory.getFundInfo(fundId);
            expect(fundInfo.isIssued).to.be.true;
            expect(fundInfo.indexToken).to.equal(indexTokenAddress);
            expect(fundInfo.totalSupply).to.equal(tokenSupply);
            
            // 인덱스 토큰 컨트랙트 확인
            const IndexToken = await ethers.getContractFactory("IndexToken");
            const indexTokenContract = IndexToken.attach(indexTokenAddress);
            
            const tokenName = await indexTokenContract.name();
            const tokenSymbol = await indexTokenContract.symbol();
            const totalSupply = await indexTokenContract.totalSupply();
            
            expect(tokenName).to.equal("K-Crypto Top 4 Index");
            expect(tokenSymbol).to.equal("KTOP4");
            expect(totalSupply).to.equal(tokenSupply);
            
            console.log(`📈 발행된 토큰 정보:`);
            console.log(`  - 이름: ${tokenName}`);
            console.log(`  - 심볼: ${tokenSymbol}`);
            console.log(`  - 총 공급량: ${ethers.utils.formatEther(totalSupply)}`);
        });
        
        it("발행된 토큰의 NAV가 정확히 계산되어야 함", async function () {
            // 이 테스트는 Hyperliquid L1 precompile이 필요하므로 스킵
            // 실제 환경에서는 _calculateTotalFundValue가 실제 가격을 가져옴
            console.log("⚠️  NAV 계산 테스트는 Hyperliquid 환경에서만 가능");
            console.log("   실제 배포 시 IL1Read.getSpotPrice()를 통해 실시간 가격 조회");
        });
    });
    
    describe("토큰 전송 및 관리", function () {
        it("플랫폼 관리자가 발행된 토큰을 투자자에게 전송할 수 있어야 함", async function () {
            const { factory, tokens, accounts } = await loadFixture(deployInstitutionalTestFixture);
            const { btc, eth, usdc, sol } = tokens;
            const { kbankInstitution, owner, user1, user2 } = accounts;
            
            // 펀드 생성, 토큰 예치, 토큰 발행 과정 (이전 테스트와 동일)
            const kCryptoComponents = [
                { tokenAddress: btc.address, hyperliquidAssetIndex: 1, targetRatio: 4000, depositedAmount: 0 },
                { tokenAddress: eth.address, hyperliquidAssetIndex: 2, targetRatio: 3000, depositedAmount: 0 },
                { tokenAddress: usdc.address, hyperliquidAssetIndex: 0, targetRatio: 2000, depositedAmount: 0 },
                { tokenAddress: sol.address, hyperliquidAssetIndex: 3, targetRatio: 1000, depositedAmount: 0 }
            ];
            
            const tx = await factory.connect(kbankInstitution).createIndexFund(
                "K-Crypto Top 4 Index", "KTOP4", kCryptoComponents
            );
            const fundId = (await tx.wait()).events.find(e => e.event === "FundCreated").args.fundId;
            
            // 토큰 예치 및 발행 (간소화)
            const depositAmounts = [
                ethers.utils.parseEther("40"),
                ethers.utils.parseEther("300"),
                ethers.utils.parseUnits("20000", 6),
                ethers.utils.parseUnits("10000", 9)
            ];
            
            for (let i = 0; i < 4; i++) {
                await [btc, eth, usdc, sol][i].connect(kbankInstitution).approve(factory.address, depositAmounts[i]);
            }
            
            await factory.connect(kbankInstitution).depositComponentTokens(
                fundId,
                [btc.address, eth.address, usdc.address, sol.address],
                depositAmounts
            );
            
            const tokenSupply = ethers.utils.parseEther("100000");
            await factory.connect(owner).issueIndexToken(fundId, tokenSupply);
            
            console.log("💸 플랫폼 관리자가 투자자들에게 KTOP4 토큰 분배 중...");
            
            // 투자자들에게 토큰 전송
            const transferAmount1 = ethers.utils.parseEther("1000"); // user1에게 1,000 KTOP4
            const transferAmount2 = ethers.utils.parseEther("2000"); // user2에게 2,000 KTOP4
            
            await factory.connect(owner).transferIndexTokens(fundId, user1.address, transferAmount1);
            await factory.connect(owner).transferIndexTokens(fundId, user2.address, transferAmount2);
            
            // 전송 확인
            const fundInfo = await factory.getFundInfo(fundId);
            const IndexToken = await ethers.getContractFactory("IndexToken");
            const indexToken = IndexToken.attach(fundInfo.indexToken);
            
            const user1Balance = await indexToken.balanceOf(user1.address);
            const user2Balance = await indexToken.balanceOf(user2.address);
            
            expect(user1Balance).to.equal(transferAmount1);
            expect(user2Balance).to.equal(transferAmount2);
            
            console.log("✅ 토큰 분배 완료:");
            console.log(`  - User1: ${ethers.utils.formatEther(user1Balance)} KTOP4`);
            console.log(`  - User2: ${ethers.utils.formatEther(user2Balance)} KTOP4`);
            console.log(`  - 남은 토큰: ${ethers.utils.formatEther(tokenSupply.sub(transferAmount1).sub(transferAmount2))} KTOP4`);
        });
    });
    
    describe("다중 기관 동시 운영", function () {
        it("K-Bank와 NH 투자증권이 동시에 서로 다른 펀드를 운영할 수 있어야 함", async function () {
            const { factory, tokens, accounts } = await loadFixture(deployInstitutionalTestFixture);
            const { btc, eth, usdc, sol, ada, dot, matic } = tokens;
            const { kbankInstitution, nhInstitution, owner } = accounts;
            
            console.log("🏦🏛️ 다중 기관 동시 펀드 운영 테스트...");
            
            // K-Bank 펀드 생성
            const kCryptoComponents = [
                { tokenAddress: btc.address, hyperliquidAssetIndex: 1, targetRatio: 5000, depositedAmount: 0 },
                { tokenAddress: eth.address, hyperliquidAssetIndex: 2, targetRatio: 3000, depositedAmount: 0 },
                { tokenAddress: usdc.address, hyperliquidAssetIndex: 0, targetRatio: 2000, depositedAmount: 0 }
            ];
            
            // NH 투자증권 펀드 생성
            const aiComponents = [
                { tokenAddress: eth.address, hyperliquidAssetIndex: 2, targetRatio: 4000, depositedAmount: 0 },
                { tokenAddress: ada.address, hyperliquidAssetIndex: 4, targetRatio: 3000, depositedAmount: 0 },
                { tokenAddress: dot.address, hyperliquidAssetIndex: 5, targetRatio: 3000, depositedAmount: 0 }
            ];
            
            // 동시 펀드 생성
            const kBankTx = await factory.connect(kbankInstitution).createIndexFund(
                "K-Crypto Major 3", "KMAJ3", kCryptoComponents
            );
            const nhTx = await factory.connect(nhInstitution).createIndexFund(
                "NH-Blockchain Infrastructure", "NHBI", aiComponents
            );
            
            const kBankFundId = (await kBankTx.wait()).events.find(e => e.event === "FundCreated").args.fundId;
            const nhFundId = (await nhTx.wait()).events.find(e => e.event === "FundCreated").args.fundId;
            
            // 두 펀드가 모두 정상 생성되었는지 확인
            const kBankFundInfo = await factory.getFundInfo(kBankFundId);
            const nhFundInfo = await factory.getFundInfo(nhFundId);
            
            expect(kBankFundInfo.creator).to.equal(kbankInstitution.address);
            expect(nhFundInfo.creator).to.equal(nhInstitution.address);
            expect(kBankFundInfo.name).to.equal("K-Crypto Major 3");
            expect(nhFundInfo.name).to.equal("NH-Blockchain Infrastructure");
            
            // 각 기관이 자신의 펀드 목록을 가지고 있는지 확인
            const kBankFunds = await factory.getCreatorFunds(kbankInstitution.address);
            const nhFunds = await factory.getCreatorFunds(nhInstitution.address);
            
            expect(kBankFunds.length).to.be.greaterThan(0);
            expect(nhFunds.length).to.be.greaterThan(0);
            expect(kBankFunds[kBankFunds.length - 1]).to.equal(kBankFundId);
            expect(nhFunds[nhFunds.length - 1]).to.equal(nhFundId);
            
            console.log("✅ 다중 기관 펀드 운영 성공:");
            console.log(`  - K-Bank 펀드: ${kBankFundInfo.name} (${kBankFundInfo.symbol})`);
            console.log(`  - NH 투자증권 펀드: ${nhFundInfo.name} (${nhFundInfo.symbol})`);
            console.log(`  - 총 K-Bank 펀드 수: ${kBankFunds.length}`);
            console.log(`  - 총 NH 펀드 수: ${nhFunds.length}`);
        });
    });
});