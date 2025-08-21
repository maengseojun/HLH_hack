// lib/ens/ens-resolver.ts
import { ethers } from 'ethers';
import { getNetworkConfig, isENSSupported } from '@/lib/config/network-config';

export interface ENSResolutionResult {
  address: string | null;
  error?: string;
  supported: boolean;
}

export const resolveENSName = async (name: string): Promise<ENSResolutionResult> => {
  // ENS 지원 여부 확인
  if (!isENSSupported()) {
    const config = getNetworkConfig();
    return {
      address: null,
      error: `ENS not supported on ${config.name}`,
      supported: false,
    };
  }
  
  // ENS 이름 형식 검증
  if (!name || typeof name !== 'string' || !name.includes('.eth')) {
    return {
      address: null,
      error: 'Invalid ENS name format',
      supported: true,
    };
  }
  
  try {
    const config = getNetworkConfig();
    
    if (!config.rpcUrl) {
      return {
        address: null,
        error: 'RPC URL not configured for ENS resolution',
        supported: true,
      };
    }
    
    // Provider 생성
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // ENS 이름 해석
    const address = await provider.resolveName(name);
    
    return {
      address,
      supported: true,
    };
    
  } catch (error) {
    console.error('ENS resolution failed:', error);
    
    return {
      address: null,
      error: error instanceof Error ? error.message : 'ENS resolution failed',
      supported: true,
    };
  }
};

export const reverseENSLookup = async (address: string): Promise<ENSResolutionResult> => {
  if (!isENSSupported()) {
    const config = getNetworkConfig();
    return {
      address: null,
      error: `ENS not supported on ${config.name}`,
      supported: false,
    };
  }
  
  // Address 형식 검증
  if (!ethers.isAddress(address)) {
    return {
      address: null,
      error: 'Invalid Ethereum address',
      supported: true,
    };
  }
  
  try {
    const config = getNetworkConfig();
    const provider = new ethers.JsonRpcProvider(config.rpcUrl!);
    
    // Reverse ENS lookup
    const name = await provider.lookupAddress(address);
    
    return {
      address: name,
      supported: true,
    };
    
  } catch (error) {
    console.error('Reverse ENS lookup failed:', error);
    
    return {
      address: null,
      error: error instanceof Error ? error.message : 'Reverse ENS lookup failed',
      supported: true,
    };
  }
};

// 안전한 contract address 해석
export const safeContractAddressResolve = async (addressOrName: string): Promise<string> => {
  // 이미 유효한 주소인 경우
  if (ethers.isAddress(addressOrName)) {
    return addressOrName;
  }
  
  // ENS 이름인 경우 해석 시도
  if (addressOrName.includes('.eth')) {
    const result = await resolveENSName(addressOrName);
    
    if (result.address && ethers.isAddress(result.address)) {
      return result.address;
    }
    
    // ENS 해석 실패 시 경고하고 빈 문자열 반환 (오류 방지)
    console.warn(`Failed to resolve ENS name: ${addressOrName}`, result.error);
    return '';
  }
  
  // 빈 문자열이나 잘못된 형식
  console.warn(`Invalid address or ENS name: ${addressOrName}`);
  return '';
};

// 개발용 mock ENS 해석기
export const mockENSResolve = (name: string): string => {
  const mockMappings: Record<string, string> = {
    'hyperindex.eth': process.env.NEXT_PUBLIC_HYPERINDEX_TOKEN_ADDRESS || '0x1234567890abcdef1234567890abcdef12345678',
    'usdc.eth': process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS || '0xabcdef1234567890abcdef1234567890abcdef12',
    'router.eth': process.env.NEXT_PUBLIC_AMM_ROUTER_ADDRESS || '0x9876543210fedcba9876543210fedcba98765432',
  };
  
  return mockMappings[name] || '';
};