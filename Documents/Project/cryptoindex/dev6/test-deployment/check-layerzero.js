// check-layerzero.js
/**
 * Check for LayerZero endpoints on HyperEVM testnet
 */

const { ethers } = require("hardhat");

async function main() {
    console.log("🔍 Checking for LayerZero endpoints on HyperEVM testnet...");
    
    const [deployer] = await ethers.getSigners();
    console.log(`👤 Using account: ${deployer.address}`);
    
    // Common LayerZero V2 endpoint addresses to check
    const possibleEndpoints = [
        "0x6EDCE65403992e310A62460808c4b910D972f10f", // Common LZ V2 endpoint
        "0x1a44076050125825900e736c501f859c50fE728c", // Another common endpoint
        "0x6c7Ab2202C98C4227C5c46f1417D81144DA716Ff"  // Alternative endpoint
    ];
    
    console.log("\n📍 Checking possible LayerZero endpoint addresses...");
    
    for (const endpoint of possibleEndpoints) {
        try {
            console.log(`\n🔎 Checking address: ${endpoint}`);
            
            // Check if there's code at this address
            const code = await ethers.provider.getCode(endpoint);
            
            if (code === "0x") {
                console.log("   ❌ No contract deployed at this address");
                continue;
            }
            
            console.log("   ✅ Contract found! Checking if it's LayerZero endpoint...");
            
            // Try to call a common LayerZero endpoint function
            try {
                // Create a simple interface for endpoint functions
                const endpointInterface = new ethers.Interface([
                    "function eid() external view returns (uint32)"
                ]);
                
                const contract = new ethers.Contract(endpoint, endpointInterface, deployer);
                const eid = await contract.eid();
                
                console.log(`   🎯 LayerZero Endpoint found! EID: ${eid}`);
                console.log(`   📍 Address: ${endpoint}`);
                
                return {
                    address: endpoint,
                    eid: eid.toString()
                };
                
            } catch (error) {
                console.log(`   ⚠️ Contract exists but may not be LayerZero endpoint: ${error.message}`);
            }
            
        } catch (error) {
            console.log(`   ❌ Error checking ${endpoint}: ${error.message}`);
        }
    }
    
    console.log("\n❌ No LayerZero endpoints found at common addresses");
    
    // Check if LayerZero might be deployed at a different address
    console.log("\n🔧 Alternative approach: Creating mock LayerZero endpoint for testing...");
    
    // For testing purposes, we can create a mock LayerZero endpoint
    const mockEndpoint = {
        address: "0x0000000000000000000000000000000000000000", // Zero address as placeholder
        eid: "40998", // Mock endpoint ID for HyperEVM testnet (40000 + chain ID)
        note: "Mock endpoint for testing - LayerZero not deployed on HyperEVM testnet yet"
    };
    
    console.log(`   📝 Mock endpoint configuration:`);
    console.log(`   Address: ${mockEndpoint.address}`);
    console.log(`   EID: ${mockEndpoint.eid}`);
    console.log(`   Note: ${mockEndpoint.note}`);
    
    return mockEndpoint;
}

main()
    .then((result) => {
        console.log("\n🎉 LayerZero endpoint check completed!");
        if (result && result.address !== "0x0000000000000000000000000000000000000000") {
            console.log(`✅ Found LayerZero endpoint: ${result.address} (EID: ${result.eid})`);
        } else {
            console.log("ℹ️ No LayerZero endpoint found - proceeding with mock configuration");
        }
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Check failed:", error);
        process.exit(1);
    });