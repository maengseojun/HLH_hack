require('@nomicfoundation/hardhat-toolbox');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-contract-sizer');
require('hardhat-gas-reporter');
require('solidity-coverage');
require('dotenv').config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x' + '00'.repeat(32);
const INFURA_API_KEY = process.env.INFURA_API_KEY || '';
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const ARBITRUMSCAN_API_KEY = process.env.ARBITRUMSCAN_API_KEY || '';
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || '';

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: '0.8.17',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  
  networks: {
    hardhat: {
      chainId: 31337,
      forking: process.env.FORK_MAINNET ? {
        url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
        blockNumber: process.env.FORK_BLOCK_NUMBER ? parseInt(process.env.FORK_BLOCK_NUMBER) : undefined,
      } : undefined,
    },
    
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },

    // Ethereum networks
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 1,
      gasPrice: 'auto',
    },
    
    sepolia: {
      url: `https://sepolia.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
    },

    // Arbitrum networks
    arbitrum: {
      url: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 42161,
      gasPrice: 'auto',
    },
    
    arbitrumSepolia: {
      url: `https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 421614,
    },

    // Polygon networks
    polygon: {
      url: `https://polygon-mainnet.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 137,
      gasPrice: 'auto',
    },
    
    polygonMumbai: {
      url: `https://polygon-mumbai.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [PRIVATE_KEY],
      chainId: 80001,
    },

    // BSC networks
    bsc: {
      url: 'https://bsc-dataseed1.binance.org/',
      accounts: [PRIVATE_KEY],
      chainId: 56,
      gasPrice: 'auto',
    },
    
    bscTestnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      accounts: [PRIVATE_KEY],
      chainId: 97,
    },

    // HyperEVM (HyperLiquid)
    hyperEvm: {
      url: 'https://api.hyperliquid-testnet.xyz/evm',
      accounts: [PRIVATE_KEY],
      chainId: 40217, // HyperEVM testnet chain ID
      gasPrice: 'auto',
    },
  },

  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY,
      sepolia: ETHERSCAN_API_KEY,
      arbitrumOne: ARBITRUMSCAN_API_KEY,
      arbitrumSepolia: ARBITRUMSCAN_API_KEY,
      polygon: POLYGONSCAN_API_KEY,
      polygonMumbai: POLYGONSCAN_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY || '',
      bscTestnet: process.env.BSCSCAN_API_KEY || '',
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io"
        }
      },
      {
        network: "hyperEvm",
        chainId: 40217,
        urls: {
          apiURL: "https://api.hyperliquid-testnet.xyz/info",
          browserURL: "https://app.hyperliquid-testnet.xyz"
        }
      }
    ]
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
    gasPrice: 20,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    excludeContracts: ['Mock*', 'Test*'],
  },

  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },

  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },

  mocha: {
    timeout: 60000,
    bail: process.env.BAIL === 'true',
  },

  // Custom task configurations
  typechain: {
    outDir: 'typechain-types',
    target: 'ethers-v5',
  },

  // LayerZero configuration
  layerZero: {
    deploymentConfigPath: './layerzero.config.js',
  },

  // Vault-specific settings
  vault: {
    defaultConfig: {
      managementFeeBps: 25,      // 0.25%
      performanceFeeBps: 0,      // 0%
      rebalanceToleranceBps: 300, // 3%
      maxTokens: 20,
    },
    
    layerZeroEndpoints: {
      1: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675',        // Ethereum
      137: '0x3c2269811836af69497E5F486A85D7316753cf62',      // Polygon
      42161: '0x3c2269811836af69497E5F486A85D7316753cf62',    // Arbitrum
      56: '0x3c2269811836af69497E5F486A85D7316753cf62',       // BSC
      40217: '0x1a44076050125825900e736c501f859c50fE728c',    // HyperEVM
    },

    hyperEvmEid: 40217,
  },
};