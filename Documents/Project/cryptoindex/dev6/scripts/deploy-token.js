// scripts/deploy-token.js
/**
 * Deploy HyperIndex Token to HyperEVM Testnet
 * Created: 2025-08-11
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying HyperIndex Token to HyperEVM Testnet...");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "HYPE");

  // Deploy HyperIndex Token (using secure version)
  console.log("\n📦 Deploying HyperIndex Token...");
  
  const HyperIndexToken = await ethers.getContractFactory("HyperIndexToken");
  
  // Token parameters
  const tokenName = "HyperIndex";
  const tokenSymbol = "HYPERINDEX";
  const initialSupply = ethers.parseEther("1000000"); // 1M tokens
  
  console.log("Token parameters:");
  console.log("- Name:", tokenName);
  console.log("- Symbol:", tokenSymbol);
  console.log("- Initial Supply:", ethers.formatEther(initialSupply));

  const token = await HyperIndexToken.deploy(
    tokenName,
    tokenSymbol,
    initialSupply,
    deployer.address // initial token holder
  );
  
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log("✅ HyperIndex Token deployed to:", tokenAddress);
  
  // Verify deployment
  const codeSize = await deployer.provider.getCode(tokenAddress);
  if (codeSize === '0x') {
    throw new Error("❌ Token deployment failed - no code at address");
  }

  // Test basic functionality
  console.log("\n🧪 Testing Token functionality...");
  
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const totalSupply = await token.totalSupply();
  const deployerBalance = await token.balanceOf(deployer.address);

  console.log("Token details:");
  console.log("- Name:", name);
  console.log("- Symbol:", symbol);
  console.log("- Decimals:", decimals.toString());
  console.log("- Total Supply:", ethers.formatEther(totalSupply));
  console.log("- Deployer Balance:", ethers.formatEther(deployerBalance));

  // Test transfer functionality
  console.log("\n🔄 Testing transfer functionality...");
  
  const testTransferAmount = ethers.parseEther("1000");
  const testRecipient = "0x000000000000000000000000000000000000dEaD"; // burn address for test
  
  try {
    const transferTx = await token.transfer(testRecipient, testTransferAmount);
    await transferTx.wait();
    
    const recipientBalance = await token.balanceOf(testRecipient);
    console.log("✅ Transfer test successful");
    console.log("- Transferred:", ethers.formatEther(testTransferAmount));
    console.log("- Recipient balance:", ethers.formatEther(recipientBalance));
    
    // Check deployer balance after transfer
    const newDeployerBalance = await token.balanceOf(deployer.address);
    console.log("- Deployer balance after test:", ethers.formatEther(newDeployerBalance));
  } catch (error) {
    console.log("❌ Transfer test failed:", error.message);
  }

  // Save deployment info
  const deploymentInfo = {
    network: "hypervm-testnet",
    chainId: 998,
    token: {
      address: tokenAddress,
      name: tokenName,
      symbol: tokenSymbol,
      decimals: decimals.toString(),
      totalSupply: ethers.formatEther(totalSupply),
      deployer: deployer.address,
      deploymentTime: new Date().toISOString(),
      transactionHash: token.deploymentTransaction().hash
    }
  };

  console.log("\n📄 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Update config file hint
  console.log("\n⚙️ Next Steps:");
  console.log("1. Update HYPERVM_TESTNET_CONFIG.contracts.hyperIndex with:", tokenAddress);
  console.log("2. Run: npx hardhat run scripts/create-pair.js --network hypervm-testnet");
  console.log("3. Add your USDC token address to HYPERVM_TESTNET_CONFIG.contracts.usdc");
  
  return tokenAddress;
}

main()
  .then((address) => {
    console.log(`\n🎉 Token deployment completed: ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });