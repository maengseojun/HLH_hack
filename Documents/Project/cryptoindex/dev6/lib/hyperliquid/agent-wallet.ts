// lib/hyperliquid/agent-wallet.ts
import { ethers } from 'ethers';

/**
 * Hyperliquid Agent Wallet System
 * 
 * Hyperliquid에서 권한을 분리하기 위한 시스템:
 * - Master Wallet: 사용자의 실제 지갑 (서명 전용)
 * - Agent Wallet: 거래 실행용 별도 지갑 (제한된 권한)
 */

export interface AgentWalletConfig {
  masterWalletAddress: string;
  agentWalletPrivateKey: string;
  agentWalletAddress: string;
  permissions: AgentPermissions;
}

export interface AgentPermissions {
  canTrade: boolean;
  canWithdraw: boolean;
  maxOrderSize?: string; // USDC 단위
  maxDailyVolume?: string; // USDC 단위
  allowedCoins?: string[]; // 거래 가능한 코인 목록
}

export interface AgentApprovalRequest {
  type: 'ApproveAgent';
  agent: string;
  name?: string;
}

export interface AgentRemovalRequest {
  type: 'RemoveApprovedAgent';
  agent: string;
}

export class HyperliquidAgentWalletService {
  private static instance: HyperliquidAgentWalletService;
  private apiUrl: string;
  private agentWallets: Map<string, AgentWalletConfig> = new Map();

  private constructor() {
    this.apiUrl = process.env.HYPERLIQUID_API_URL || 'https://api.hyperliquid.xyz';
  }

  static getInstance(): HyperliquidAgentWalletService {
    if (!HyperliquidAgentWalletService.instance) {
      HyperliquidAgentWalletService.instance = new HyperliquidAgentWalletService();
    }
    return HyperliquidAgentWalletService.instance;
  }

  /**
   * Agent 지갑 생성 및 등록
   */
  async createAgentWallet(
    masterWalletAddress: string,
    permissions: AgentPermissions
  ): Promise<AgentWalletConfig> {
    try {
      // 새로운 Agent 지갑 생성
      const agentWallet = ethers.Wallet.createRandom();
      
      const config: AgentWalletConfig = {
        masterWalletAddress,
        agentWalletPrivateKey: agentWallet.privateKey,
        agentWalletAddress: agentWallet.address,
        permissions
      };

      // 메모리에 설정 저장 (실제로는 암호화된 데이터베이스에 저장해야 함)
      this.agentWallets.set(masterWalletAddress, config);

      console.log(`✅ Agent 지갑 생성 완료:`, {
        master: masterWalletAddress,
        agent: agentWallet.address,
        permissions
      });

      return config;
    } catch (_error) {
      console.error('❌ Agent 지갑 생성 실패:', _error);
      throw _error;
    }
  }

  /**
   * Master 지갑에서 Agent 승인 요청 생성
   */
  createAgentApprovalRequest(
    agentWalletAddress: string,
    agentName?: string
  ): AgentApprovalRequest {
    return {
      type: 'ApproveAgent',
      agent: agentWalletAddress,
      ...(agentName && { name: agentName })
    };
  }

  /**
   * Agent 승인 요청을 Hyperliquid에 전송
   */
  async approveAgent(
    masterWallet: ethers.Wallet,
    agentWalletAddress: string,
    agentName?: string
  ): Promise<boolean> {
    try {
      const approvalRequest = this.createAgentApprovalRequest(agentWalletAddress, agentName);
      
      // Hyperliquid API로 Agent 승인 요청 전송
      const signedRequest = await this.signHyperliquidRequest(masterWallet, approvalRequest);
      
      const response = await fetch(`${this.apiUrl}/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedRequest)
      });

      if (response.ok) {
        console.log(`✅ Agent 승인 완료: ${agentWalletAddress}`);
        return true;
      } else {
        console.error('❌ Agent 승인 실패:', await response.text());
        return false;
      }
    } catch (_error) {
      console.error('❌ Agent 승인 요청 실패:', _error);
      return false;
    }
  }

  /**
   * Agent 제거 요청
   */
  async removeAgent(
    masterWallet: ethers.Wallet,
    agentWalletAddress: string
  ): Promise<boolean> {
    try {
      const removalRequest: AgentRemovalRequest = {
        type: 'RemoveApprovedAgent',
        agent: agentWalletAddress
      };
      
      const signedRequest = await this.signHyperliquidRequest(masterWallet, removalRequest);
      
      const response = await fetch(`${this.apiUrl}/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedRequest)
      });

      if (response.ok) {
        console.log(`✅ Agent 제거 완료: ${agentWalletAddress}`);
        this.agentWallets.delete(masterWallet.address);
        return true;
      } else {
        console.error('❌ Agent 제거 실패:', await response.text());
        return false;
      }
    } catch (_error) {
      console.error('❌ Agent 제거 요청 실패:', _error);
      return false;
    }
  }

  /**
   * Agent 지갑으로 거래 실행
   */
  async executeTradeWithAgent(
    masterWalletAddress: string,
    tradeRequest: any
  ): Promise<any> {
    try {
      const agentConfig = this.agentWallets.get(masterWalletAddress);
      if (!agentConfig) {
        throw new Error('Agent 지갑이 설정되지 않음');
      }

      // 권한 확인
      if (!agentConfig.permissions.canTrade) {
        throw new Error('Agent에게 거래 권한이 없음');
      }

      // 거래 크기 제한 확인
      if (agentConfig.permissions.maxOrderSize) {
        const orderSize = parseFloat(tradeRequest.sz || '0');
        const maxSize = parseFloat(agentConfig.permissions.maxOrderSize);
        if (orderSize > maxSize) {
          throw new Error(`주문 크기 제한 초과: ${orderSize} > ${maxSize}`);
        }
      }

      // 허용된 코인 확인
      if (agentConfig.permissions.allowedCoins) {
        const coin = tradeRequest.coin;
        if (!agentConfig.permissions.allowedCoins.includes(coin)) {
          throw new Error(`허용되지 않은 코인: ${coin}`);
        }
      }

      // Agent 지갑으로 거래 실행
      const agentWallet = new ethers.Wallet(agentConfig.agentWalletPrivateKey);
      const signedRequest = await this.signHyperliquidRequest(agentWallet, tradeRequest);
      
      const response = await fetch(`${this.apiUrl}/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signedRequest)
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log(`✅ Agent 거래 실행 완료:`, result);
        return result;
      } else {
        console.error('❌ Agent 거래 실행 실패:', result);
        throw new Error(result.error || 'Agent 거래 실행 실패');
      }
    } catch (_error) {
      console.error('❌ Agent 거래 실행 중 오류:', _error);
      throw _error;
    }
  }

  /**
   * Agent 상태 및 논스 확인
   */
  async getAgentStatus(masterWalletAddress: string): Promise<{
    agentAddress?: string;
    isApproved: boolean;
    nonce?: number;
    permissions?: AgentPermissions;
  }> {
    try {
      const agentConfig = this.agentWallets.get(masterWalletAddress);
      if (!agentConfig) {
        return { isApproved: false };
      }

      // Hyperliquid에서 Agent 상태 확인
      const response = await fetch(`${this.apiUrl}/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: masterWalletAddress
        })
      });

      const data = await response.json();
      
      return {
        agentAddress: agentConfig.agentWalletAddress,
        isApproved: true, // 실제로는 API 응답에서 확인
        nonce: data.nonce || 0,
        permissions: agentConfig.permissions
      };
    } catch (_error) {
      console.error('❌ Agent 상태 확인 실패:', _error);
      return { isApproved: false };
    }
  }

  /**
   * Hyperliquid 요청 서명
   */
  private async signHyperliquidRequest(
    wallet: ethers.Wallet,
    request: any
  ): Promise<any> {
    // 실제 Hyperliquid 서명 로직 구현
    // 이는 Hyperliquid의 공식 서명 방식을 따라야 함
    
    const timestamp = Date.now();
    const message = JSON.stringify(request);
    
    // EIP-712 서명 또는 Hyperliquid 특정 서명 방식 사용
    const signature = await wallet.signMessage(message);
    
    return {
      action: request,
      nonce: timestamp,
      signature: signature,
      vaultAddress: null // 개인 지갑의 경우 null
    };
  }

  /**
   * Agent 지갑 설정 조회
   */
  getAgentConfig(masterWalletAddress: string): AgentWalletConfig | undefined {
    return this.agentWallets.get(masterWalletAddress);
  }

  /**
   * Agent 권한 업데이트
   */
  updateAgentPermissions(
    masterWalletAddress: string,
    newPermissions: Partial<AgentPermissions>
  ): boolean {
    try {
      const agentConfig = this.agentWallets.get(masterWalletAddress);
      if (!agentConfig) {
        return false;
      }

      agentConfig.permissions = {
        ...agentConfig.permissions,
        ...newPermissions
      };

      this.agentWallets.set(masterWalletAddress, agentConfig);
      
      console.log(`✅ Agent 권한 업데이트 완료:`, {
        master: masterWalletAddress,
        permissions: agentConfig.permissions
      });

      return true;
    } catch (_error) {
      console.error('❌ Agent 권한 업데이트 실패:', _error);
      return false;
    }
  }

  /**
   * 모든 Agent 지갑 정보 조회 (관리자용)
   */
  getAllAgentConfigs(): Map<string, AgentWalletConfig> {
    return new Map(this.agentWallets);
  }

  /**
   * Agent 지갑 정리 (메모리 정리용)
   */
  clearAgentWallets(): void {
    this.agentWallets.clear();
    console.log('✅ Agent 지갑 메모리 정리 완료');
  }
}

// 기본 Agent 권한 설정
export const DEFAULT_AGENT_PERMISSIONS: AgentPermissions = {
  canTrade: true,
  canWithdraw: false, // 출금은 Master 지갑에서만
  maxOrderSize: '10000', // 최대 10,000 USDC per order
  maxDailyVolume: '100000', // 최대 100,000 USDC per day
  allowedCoins: ['BTC', 'ETH', 'SOL'] // 주요 코인만 허용
};

// 제한적 Agent 권한 설정 (테스트용)
export const RESTRICTED_AGENT_PERMISSIONS: AgentPermissions = {
  canTrade: true,
  canWithdraw: false,
  maxOrderSize: '100', // 최대 100 USDC per order
  maxDailyVolume: '1000', // 최대 1,000 USDC per day
  allowedCoins: ['BTC', 'ETH'] // BTC, ETH만 허용
};