const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Running Complete System Test on HyperEVM Testnet...\n");
    
    const [deployer] = await ethers.getSigners();
    
    try {
        // 1. Deploy Factory
        console.log("1️⃣ Deploying IndexTokenFactory...");
        const IndexTokenFactory = await ethers.getContractFactory("IndexTokenFactory");
        const factory = await IndexTokenFactory.deploy(deployer.address);
        await factory.deployed();
        console.log("✅ Factory deployed at:", factory.address);
        
        // 2. Deploy Mock ERC20 tokens for testing
        console.log("\n2️⃣ Deploying test tokens...");
        const MockERC20 = await ethers.getContractFactory("MockERC20");
        
        const weth = await MockERC20.deploy("Wrapped ETH", "WETH", 18);
        await weth.deployed();
        console.log("✅ WETH deployed at:", weth.address);
        
        const wbtc = await MockERC20.deploy("Wrapped BTC", "WBTC", 8);
        await wbtc.deployed();
        console.log("✅ WBTC deployed at:", wbtc.address);
        
        // 3. Authorize tokens
        console.log("\n3️⃣ Authorizing tokens...");
        await factory.authorizeToken(weth.address, true);
        await factory.authorizeToken(wbtc.address, true);
        console.log("✅ Tokens authorized");
        
        // 4. Create index token
        console.log("\n4️⃣ Creating index token...");
        const tokens = [weth.address, wbtc.address];
        const weights = [6000, 4000]; // 60% WETH, 40% WBTC
        const minAmount = ethers.utils.parseEther("0.001");
        
        const tx = await factory.createIndexToken(
            "Crypto Index",
            "CRYIDX",
            tokens,
            weights,
            minAmount,
            deployer.address // manager
        );
        
        const receipt = await tx.wait();
        const event = receipt.events?.find(e => e.event === 'IndexTokenCreated');
        const indexTokenAddress = event?.args?.tokenAddress;
        
        console.log("✅ Index token created at:", indexTokenAddress);
        
        // 5. Test token issuance
        console.log("\n5️⃣ Testing token issuance...");
        const IndexToken = await ethers.getContractFactory("IndexToken");
        const indexToken = IndexToken.attach(indexTokenAddress);
        
        // Mint some mock tokens to deployer
        await weth.mint(deployer.address, ethers.utils.parseEther("10"));
        await wbtc.mint(deployer.address, ethers.utils.parseUnits("1", 8));
        
        // Approve tokens
        await weth.approve(indexTokenAddress, ethers.utils.parseEther("1"));
        await wbtc.approve(indexTokenAddress, ethers.utils.parseUnits("0.1", 8));
        
        // Issue index tokens
        const issueTx = await indexToken.issueTokens(
            ethers.utils.parseEther("0.001")
        );
        await issueTx.wait();
        
        const balance = await indexToken.balanceOf(deployer.address);
        console.log("✅ Index tokens issued:", ethers.utils.formatEther(balance));
        
        // 6. Test redemption
        console.log("\n6️⃣ Testing redemption...");
        const redeemTx = await indexToken.redeemTokens(
            ethers.utils.parseEther("0.0005")
        );
        await redeemTx.wait();
        
        const newBalance = await indexToken.balanceOf(deployer.address);
        console.log("✅ Remaining tokens:", ethers.utils.formatEther(newBalance));
        
        console.log("\n🎉 All tests completed successfully!");
        console.log("\n📋 Contract Addresses:");
        console.log("Factory:", factory.address);
        console.log("WETH:", weth.address);
        console.log("WBTC:", wbtc.address);
        console.log("Index Token:", indexTokenAddress);
        
    } catch (error) {
        console.error("\n❌ Test failed:", error.message);
        throw error;
    }
}

main()
    .then(() => {
        console.log("\n✅ System test completed!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ System test failed:", error);
        process.exit(1);
    });
