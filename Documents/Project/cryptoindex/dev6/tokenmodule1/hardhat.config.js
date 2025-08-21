require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    "hyperevm-testnet": {
      url: "https://api.hyperliquid-testnet.xyz/evm",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 998, // HyperEVM Testnet Chain ID
      gasPrice: "auto",
      gas: "auto",
    },
    "hyperevm-mainnet": {
      url: "https://api.hyperliquid.xyz/evm",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 42161, // HyperEVM Mainnet Chain ID (임시)
      gasPrice: "auto",
      gas: "auto",
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    // HyperEVM explorer API key (if available)
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};
