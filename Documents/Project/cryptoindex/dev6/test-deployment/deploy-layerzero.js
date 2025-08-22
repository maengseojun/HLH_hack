// deploy-layerzero.js
/**
 * Deploy LayerZero integration components and test cross-chain messaging
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("🔗 Deploying LayerZero Integration Components...");
    
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`👤 Deployer: ${deployer.address}`);
    console.log(`💰 Balance: ${ethers.formatEther(balance)} HYPE`);
    
    // Load existing deployment info
    let deploymentInfo;
    try {
        deploymentInfo = JSON.parse(require('fs').readFileSync('testnet-deployment.json', 'utf8'));
        console.log("📋 Loaded existing deployment info");
    } catch (error) {
        console.error("❌ Could not load deployment info:", error.message);
        process.exit(1);
    }
    
    try {
        // 1. Deploy Mock LayerZero Endpoint
        console.log("\n1. 🚀 Deploying Mock LayerZero Endpoint...");
        const MockLayerZeroEndpoint = await ethers.getContractFactory("MockLayerZeroEndpoint");
        const mockLzEndpoint = await MockLayerZeroEndpoint.deploy(40998); // EID for HyperEVM testnet
        await mockLzEndpoint.waitForDeployment();
        const lzEndpointAddress = await mockLzEndpoint.getAddress();
        console.log(`   ✅ Mock LayerZero Endpoint: ${lzEndpointAddress}`);
        console.log(`   🆔 Endpoint ID (EID): 40998`);
        
        // 2. Deploy HyperIndexVault with LayerZero integration
        console.log("\n2. 🏦 Deploying HyperIndexVault...");
        const HyperIndexVault = await ethers.getContractFactory("HyperIndexVault");
        const hyperIndexVault = await HyperIndexVault.deploy(
            ethers.ZeroAddress, // template asset
            "HyperIndex Vault with LayerZero",
            "HIYZ"
        );
        await hyperIndexVault.waitForDeployment();
        const hyperVaultAddress = await hyperIndexVault.getAddress();
        console.log(`   ✅ HyperIndexVault: ${hyperVaultAddress}`);
        
        // 3. Initialize HyperIndexVault
        console.log("\n3. ⚙️ Initializing HyperIndexVault...");
        
        // Use deployed mock tokens as underlying assets
        const underlyingTokens = [
            deploymentInfo.contracts.mockUSDC,
            deploymentInfo.contracts.mockWETH,
            deploymentInfo.contracts.mockWBTC
        ];
        
        // Target allocations: 40% USDC, 30% WETH, 30% WBTC
        const targetAllocations = [4000, 3000, 3000];
        
        await hyperIndexVault.initialize(
            deploymentInfo.contracts.mockUSDC, // Use USDC as base asset
            1, // Index token ID
            deployer.address, // Admin
            "HyperIndex Multi-Asset Vault",
            "HIMAV",
            lzEndpointAddress, // LayerZero endpoint
            underlyingTokens,
            targetAllocations
        );
        console.log("   ✅ HyperIndexVault initialized");
        console.log(`   📊 Underlying tokens: ${underlyingTokens.length}`);
        console.log(`   🎯 Target allocations: [${targetAllocations.join(', ')}]`);
        
        // 4. Test LayerZero endpoint functionality
        console.log("\n4. 🧪 Testing LayerZero Mock Endpoint...");
        
        // Get endpoint ID
        const eid = await mockLzEndpoint.eid();
        console.log(`   📡 Endpoint ID: ${eid}`);
        
        // Test quote function
        const testMessage = ethers.toUtf8Bytes("Hello HyperEVM!");
        const quote = await mockLzEndpoint.quote(
            40999, // Destination EID (mock)
            deployer.address,
            testMessage,
            "0x" // Empty options
        );
        console.log(`   💸 Message quote: ${quote} wei`);
        
        // 5. Test cross-chain message sending (simulation)
        console.log("\n5. 📤 Testing Cross-chain Message Sending...");
        
        const sendTx = await mockLzEndpoint.send(
            40999, // Destination EID (mock destination chain)
            deployer.address, // Receiver
            testMessage,
            "0x", // Options
            0 // Fee
        );
        
        const receipt = await sendTx.wait();
        console.log(`   ✅ Message sent! TX: ${sendTx.hash}`);
        
        // Check for events
        const packetSentEvent = receipt.logs.find(log => {
            try {
                const parsed = mockLzEndpoint.interface.parseLog(log);
                return parsed.name === 'PacketSent';
            } catch {
                return false;
            }
        });
        
        if (packetSentEvent) {
            const parsed = mockLzEndpoint.interface.parseLog(packetSentEvent);
            console.log(`   📨 Packet sent to EID: ${parsed.args.dstEid}`);
            console.log(`   📬 Nonce: ${parsed.args.nonce}`);
        }
        
        // 6. Check pending messages
        const pendingCount = await mockLzEndpoint.getPendingMessagesCount();
        console.log(`   📥 Pending messages: ${pendingCount}`);
        
        if (pendingCount > 0) {
            const pendingMsg = await mockLzEndpoint.getPendingMessage(0);
            console.log(`   📩 First pending message from EID: ${pendingMsg.srcEid}`);
        }
        
        // 7. Test HyperIndexVault deposit with cross-chain event
        console.log("\n6. 💰 Testing Vault Deposit with Cross-chain Integration...");
        
        // Get USDC contract and mint some tokens
        const mockUSDC = await ethers.getContractAt("MockERC20", deploymentInfo.contracts.mockUSDC);
        const depositAmount = ethers.parseUnits("1000", 6); // 1000 USDC
        
        // Approve vault to spend USDC
        await mockUSDC.approve(hyperVaultAddress, depositAmount);
        console.log(`   ✅ Approved ${ethers.formatUnits(depositAmount, 6)} USDC`);
        
        // Make deposit
        const depositTx = await hyperIndexVault.deposit(depositAmount, deployer.address);
        await depositTx.wait();
        console.log(`   ✅ Deposited ${ethers.formatUnits(depositAmount, 6)} USDC`);
        
        // Check vault balance
        const vaultShares = await hyperIndexVault.balanceOf(deployer.address);
        const vaultAssets = await hyperIndexVault.totalAssets();
        console.log(`   📊 Vault shares: ${ethers.formatEther(vaultShares)}`);
        console.log(`   📊 Total assets: ${ethers.formatUnits(vaultAssets, 6)} USDC`);
        
        // 8. Test allocation ratios
        console.log("\n7. 📊 Testing Allocation Ratios...");
        
        const allocations = await hyperIndexVault.getAllocationRatios();
        console.log(`   🎯 Target allocations:`);
        for (let i = 0; i < allocations.tokens.length; i++) {
            const tokenAddress = allocations.tokens[i];
            const currentRatio = allocations.currentRatios[i];
            const targetRatio = allocations.targetRatios[i];
            
            // Get token symbol for display
            let symbol = "Unknown";
            if (tokenAddress === deploymentInfo.contracts.mockUSDC) symbol = "USDC";
            if (tokenAddress === deploymentInfo.contracts.mockWETH) symbol = "WETH";
            if (tokenAddress === deploymentInfo.contracts.mockWBTC) symbol = "WBTC";
            
            console.log(`     ${symbol}: ${currentRatio/100}% current, ${targetRatio/100}% target`);
        }
        
        // Update deployment info
        deploymentInfo.contracts.mockLayerZeroEndpoint = lzEndpointAddress;
        deploymentInfo.contracts.hyperIndexVault = hyperVaultAddress;
        deploymentInfo.layerZero = {
            endpointId: eid.toString(),
            endpointAddress: lzEndpointAddress,
            testMessageSent: true,
            pendingMessages: pendingCount.toString()
        };
        
        // Save updated deployment info
        console.log("\n💾 Updating deployment info...");
        require('fs').writeFileSync(
            'testnet-deployment.json',
            JSON.stringify(deploymentInfo, null, 2)
        );
        console.log("   ✅ Deployment info updated");
        
        console.log("\n🎉 LayerZero Integration Deployment Completed!");
        console.log("\n📊 New Components Summary:");
        console.log(`   Mock LayerZero Endpoint: ${lzEndpointAddress}`);
        console.log(`   HyperIndexVault: ${hyperVaultAddress}`);
        console.log(`   Endpoint ID: ${eid}`);
        console.log(`   Test Messages: ${pendingCount} pending`);
        
        console.log("\n💡 Next Steps:");
        console.log("   1. Set up 1inch API integration for rebalancing");
        console.log("   2. Test cross-chain vault operations");
        console.log("   3. Configure security systems");
        console.log("   4. Run comprehensive E2E tests");
        
    } catch (error) {
        console.error("\n❌ LayerZero deployment failed:", error.message);
        
        if (error.message.includes("insufficient funds")) {
            console.log("\n💡 Need more HYPE tokens for deployment");
        }
        
        throw error;
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });