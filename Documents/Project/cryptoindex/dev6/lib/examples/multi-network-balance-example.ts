// lib/examples/multi-network-balance-example.ts
import { ethers } from 'ethers';

// 예시: 같은 주소가 여러 네트워크에서 어떻게 다른 잔액을 가지는지
export async function demonstrateMultiNetworkBalance() {
  const walletAddress = '0x993e1d72E2942647AA17c6a1abfFE2D9d204cB10';
  
  // 1. ARBITRUM의 USDC 잔액
  const arbitrumProvider = new ethers.JsonRpcProvider('https://arb1.arbitrum.io/rpc');
  const arbitrumUSDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'; // Arbitrum USDC
  
  const arbitrumContract = new ethers.Contract(
    arbitrumUSDC,
    ['function balanceOf(address) view returns (uint256)'],
    arbitrumProvider
  );
  
  // 2. HYPERLIQUID의 USDC 잔액  
  const hyperliquidProvider = new ethers.JsonRpcProvider('https://rpc.hyperliquid.xyz/evm');
  
  // Hyperliquid에서는 USDC가 native token이거나 다른 컨트랙트 주소를 가짐
  // 여기서는 native balance를 확인
  
  try {
    // 같은 주소, 다른 네트워크, 다른 결과
    const arbitrumBalance = await arbitrumContract.balanceOf(walletAddress);
    const hyperliquidBalance = await hyperliquidProvider.getBalance(walletAddress);
    
    console.log('🏦 Multi-Network Balance for:', walletAddress);
    console.log('📊 Arbitrum USDC:', ethers.formatUnits(arbitrumBalance, 6)); // USDC 6 decimals
    console.log('💰 Hyperliquid Native:', ethers.formatEther(hyperliquidBalance)); // 18 decimals
    
    return {
      address: walletAddress,
      arbitrum: {
        usdc: ethers.formatUnits(arbitrumBalance, 6),
        network: 'Arbitrum One (Chain ID: 42161)',
        contract: arbitrumUSDC
      },
      hyperliquid: {
        native: ethers.formatEther(hyperliquidBalance),
        network: 'Hyperliquid (Chain ID: 999)',
        contract: 'native'
      }
    };
  } catch (_error) {
    console.error('Balance check failed:', _error);
    return null;
  }
}

// 실제 잔액이 어떻게 다른지 보여주는 함수
export function explainNetworkSeparation() {
  return {
    concept: "하나의 EVM 주소, 여러 네트워크",
    
    reality: {
      "0x993e1d...cB10": {
        ethereum: {
          eth: "1.5 ETH",
          usdc: "1000 USDC (0xA0b86a33E6...)"
        },
        arbitrum: {
          eth: "0.1 ETH", 
          usdc: "500 USDC (0xaf88d065e7...)"
        },
        hyperliquid: {
          hype: "100 HYPE",
          usdc: "250 USDC"
        }
      }
    },
    
    keyPoints: [
      "같은 주소지만 네트워크마다 완전히 별개의 잔액",
      "Arbitrum의 100 USDC는 Ethereum의 100 USDC와 다른 자산",
      "각 네트워크는 독립적인 블록체인",
      "토큰 컨트랙트 주소도 네트워크마다 다름",
      "브릿지를 통해서만 네트워크 간 자산 이동 가능"
    ],
    
    analogy: "같은 계좌번호로 다른 은행에 계좌가 있는 것과 같음",
    
    practicalExample: {
      scenario: "Alice의 지갑 주소: 0xABC...123",
      balances: {
        "국민은행(Ethereum)": "100만원",
        "신한은행(Arbitrum)": "50만원", 
        "우리은행(Hyperliquid)": "30만원"
      },
      note: "같은 계좌번호지만 은행이 다르면 잔액도 독립적"
    }
  };
}

// 네트워크별 토큰 주소가 다른 예시
export const USDC_ADDRESSES_BY_NETWORK = {
  ethereum: '0xA0b86a33E6724e311b5AAb2D3F84069d5c6C7C02',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 
  polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  hyperliquid: 'native', // Hyperliquid에서는 USDC가 native일 수 있음
} as const;

// 네트워크별 RPC URL
export const NETWORK_RPC_URLS = {
  ethereum: 'https://eth.llamarpc.com',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  hyperliquid: 'https://rpc.hyperliquid.xyz/evm',
} as const;

// 체인 ID별 네트워크 이름
export const CHAIN_ID_TO_NETWORK = {
  1: 'ethereum',
  42161: 'arbitrum', 
  999: 'hyperliquid',
} as const;