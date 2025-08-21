require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

/**
 * 🍴 Hardhat Fork Configuration
 * HyperEVM 또는 다른 네트워크를 포크하여 테스트하기 위한 설정
 */

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Stack too deep 문제 해결
    },
  },
  
  networks: {
    // 로컬 Hardhat 네트워크 (기본)
    hardhat: {
      chainId: 31337,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10,
        accountsBalance: "10000000000000000000000", // 10,000 ETH
      },
      mining: {
        auto: true,
        interval: 0 // 즉시 마이닝
      }
    },
    
    // HyperEVM 시뮬레이션 (Chain ID 998)
    hyperevmSim: {
      url: "http://127.0.0.1:8545",
      chainId: 998,
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10,
        accountsBalance: "10000000000000000000000"
      },
      // HyperEVM 특성 시뮬레이션
      gasPrice: 1000000000, // 1 gwei
      gas: 30000000,
      blockGasLimit: 30000000,
    },
    
    // Arbitrum Sepolia 포크
    arbitrumSepoliaFork: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      forking: {
        url: process.env.ARBITRUM_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
        enabled: true,
        blockNumber: undefined // 최신 블록
      },
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10,
        accountsBalance: "10000000000000000000000"
      }
    },
    
    // Polygon Amoy 포크
    polygonAmoyFork: {
      url: "http://127.0.0.1:8545", 
      chainId: 31337,
      forking: {
        url: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology",
        enabled: true,
        blockNumber: undefined
      },
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
        count: 10,
        accountsBalance: "10000000000000000000000"
      }
    },
    
    // 실제 테스트넷 (토큰이 있는 경우)
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== "your_private_key_here" 
        ? [process.env.PRIVATE_KEY] 
        : [],
      gasPrice: 1000000000,
      eid: 40231,
      lzEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f"
    },
    
    polygonAmoy: {
      url: process.env.POLYGON_AMOY_RPC || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== "your_private_key_here" 
        ? [process.env.PRIVATE_KEY] 
        : [],
      gasPrice: 30000000000,
      eid: 40109,
      lzEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f"
    },
    
    // HyperEVM 테스트넷 (토큰이 있는 경우)
    hyperevmTestnet: {
      url: process.env.HYPEREVM_RPC || "https://api.hyperliquid-testnet.xyz/evm",
      chainId: 998,
      accounts: process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== "your_private_key_here" 
        ? [process.env.PRIVATE_KEY] 
        : [],
      gasPrice: 1000000000,
      eid: 30999,
      lzEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f"
    }
  },
  
  // LayerZero 설정
  layerzero: {
    endpoints: {
      hardhat: "0x6EDCE65403992e310A62460808c4b910D972f10f", // Mock endpoint
      hyperevmSim: "0x6EDCE65403992e310A62460808c4b910D972f10f",
      arbitrumSepoliaFork: "0x6EDCE65403992e310A62460808c4b910D972f10f",
      polygonAmoyFork: "0x6EDCE65403992e310A62460808c4b910D972f10f"
    },
    eids: {
      hardhat: 31337,
      hyperevmSim: 30999,
      arbitrumSepoliaFork: 40231,
      polygonAmoyFork: 40109
    }
  },
  
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  
  etherscan: {
    apiKey: {
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    }
  },
};