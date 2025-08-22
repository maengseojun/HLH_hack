// test-deployment/hardhat.config.js
/**
 * Minimal Hardhat configuration for testnet deployment testing
 */

require("@nomicfoundation/hardhat-ethers");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      },
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ]
  },
  
  networks: {
    "hypervm-testnet": {
      url: process.env.HYPERVM_TESTNET_RPC || "https://rpc.hyperliquid-testnet.xyz/evm",
      chainId: 998,
      accounts: ["70f7b34aecb3abf3e28d39df77a61fecb5add1fb2f1b58810440d86b36fa12f8"],
      gasPrice: 500000000, // 0.5 gwei (increased)
      gas: 5000000, // increased gas limit
      timeout: 120000 // increased timeout
    }
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};