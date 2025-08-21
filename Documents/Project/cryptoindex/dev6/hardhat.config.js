// hardhat.config.js
/**
 * Hardhat configuration for HyperEVM deployment
 * Created: 2025-08-11
 */

require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      },
      viaIR: true
    }
  },
  
  networks: {
    "hypervm-testnet": {
      url: process.env.HYPERVM_TESTNET_RPC || "https://rpc.hyperliquid-testnet.xyz/evm",
      chainId: 998,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 1,  // 1 wei - HyperEVM optimal
      gas: 3000000,  // 3M gas limit
      blockGasLimit: 30000000,  // 30M block gas limit  
      timeout: 60000,  // 60초 timeout
      confirmations: 1  // 1 confirmation only
    },
    
    "hypervm-mainnet": {
      url: process.env.HYPERVM_MAINNET_RPC || "https://api.hyperliquid.xyz/evm",
      chainId: 999,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: "auto",
      gas: "auto"
    }
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },

  mocha: {
    timeout: 60000 // 60 seconds
  }
};