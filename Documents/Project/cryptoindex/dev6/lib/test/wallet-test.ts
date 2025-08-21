// lib/test/wallet-test.ts
import { HyperliquidBridgeService } from '@/lib/blockchain/hyperliquid-bridge';
import { privyConfig } from '@/lib/privy/config';
import { ethers } from 'ethers';

export interface WalletTestResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export class WalletSystemTester {
  private bridgeService: HyperliquidBridgeService;
  private testResults: WalletTestResult[] = [];

  constructor() {
    this.bridgeService = HyperliquidBridgeService.getInstance();
  }

  /**
   * 전체 지갑 시스템 테스트 실행
   */
  async runCompleteTest(): Promise<WalletTestResult[]> {
    console.log('🚀 지갑 시스템 종합 테스트 시작...\n');
    
    this.testResults = [];

    // 1. 환경 변수 검증
    await this.testEnvironmentVariables();

    // 2. Privy 설정 검증
    await this.testPrivyConfiguration();

    // 3. 네트워크 연결 테스트
    await this.testNetworkConnectivity();

    // 4. Hyperliquid API 연결 테스트
    await this.testHyperliquidAPI();

    // 5. 브릿지 기능 테스트
    await this.testBridgeFunctionality();

    // 6. 지갑 생성 및 관리 테스트
    await this.testWalletManagement();

    return this.testResults;
  }

  /**
   * 환경 변수 검증
   */
  private async testEnvironmentVariables(): Promise<void> {
    console.log('📋 환경 변수 검증 중...');

    const requiredEnvVars = [
      'NEXT_PUBLIC_PRIVY_APP_ID',
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_APP_URL'
    ];

    const optionalEnvVars = [
      'PRIVY_APP_SECRET',
      'PRIVY_VERIFICATION_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ARBITRUM_RPC_URL',
      'HYPERLIQUID_RPC_URL'
    ];

    // 필수 환경 변수 체크
    const missingRequired = requiredEnvVars.filter(
      varName => !process.env[varName]
    );

    if (missingRequired.length === 0) {
      this.addResult('환경 변수', 'pass', '모든 필수 환경 변수가 설정됨');
    } else {
      this.addResult(
        '환경 변수', 
        'fail', 
        `누락된 필수 환경 변수: ${missingRequired.join(', ')}`
      );
    }

    // 선택적 환경 변수 체크
    const missingOptional = optionalEnvVars.filter(
      varName => !process.env[varName]
    );

    if (missingOptional.length > 0) {
      this.addResult(
        '선택적 환경 변수', 
        'warning', 
        `누락된 선택적 환경 변수: ${missingOptional.join(', ')}`
      );
    }
  }

  /**
   * Privy 설정 검증
   */
  private async testPrivyConfiguration(): Promise<void> {
    console.log('🔐 Privy 설정 검증 중...');

    try {
      // Privy 설정 유효성 검사
      const appId = privyConfig.appId;
      const supportedChains = privyConfig.supportedChains;
      const loginMethods = privyConfig.loginMethods;

      if (!appId) {
        this.addResult('Privy 설정', 'fail', 'Privy App ID가 설정되지 않음');
        return;
      }

      // 체인 설정 검증
      const hasArbitrum = supportedChains?.some(chain => chain.id === 42161 || chain.id === 421614);
      const hasHyperliquid = supportedChains?.some(chain => chain.id === 999 || chain.id === 998);

      if (!hasArbitrum || !hasHyperliquid) {
        this.addResult(
          'Privy 체인 설정', 
          'warning', 
          `누락된 네트워크 - Arbitrum: ${hasArbitrum}, Hyperliquid: ${hasHyperliquid}`
        );
      } else {
        this.addResult('Privy 체인 설정', 'pass', 'Arbitrum과 Hyperliquid 네트워크 설정됨');
      }

      // 로그인 방법 검증
      const hasEmail = loginMethods?.includes('email');
      const hasWallet = loginMethods?.includes('wallet');

      if (hasEmail && hasWallet) {
        this.addResult('Privy 로그인 설정', 'pass', '이메일 및 지갑 로그인 활성화됨');
      } else {
        this.addResult(
          'Privy 로그인 설정', 
          'warning', 
          `누락된 로그인 방법 - Email: ${hasEmail}, Wallet: ${hasWallet}`
        );
      }

    } catch (_error) {
      this.addResult(
        'Privy 설정', 
        'fail', 
        `Privy 설정 검증 실패: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`
      );
    }
  }

  /**
   * 네트워크 연결 테스트
   */
  private async testNetworkConnectivity(): Promise<void> {
    console.log('🌐 네트워크 연결 테스트 중...');

    // Arbitrum Sepolia 테스트
    try {
      const arbitrumProvider = new ethers.JsonRpcProvider(
        process.env.ARBITRUM_RPC_URL || 'https://arbitrum-sepolia.public.blastapi.io'
      );
      
      const blockNumber = await arbitrumProvider.getBlockNumber();
      this.addResult(
        'Arbitrum 연결', 
        'pass', 
        `성공적으로 연결됨 (블록 #${blockNumber})`
      );
    } catch (_error) {
      this.addResult(
        'Arbitrum 연결', 
        'fail', 
        `연결 실패: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`
      );
    }

    // Hyperliquid 테스트넷 테스트
    try {
      const hyperliquidProvider = new ethers.JsonRpcProvider(
        process.env.HYPERLIQUID_RPC_URL || 'https://rpc.hyperliquid-testnet.xyz/evm'
      );
      
      const blockNumber = await hyperliquidProvider.getBlockNumber();
      this.addResult(
        'Hyperliquid 연결', 
        'pass', 
        `성공적으로 연결됨 (블록 #${blockNumber})`
      );
    } catch (_error) {
      this.addResult(
        'Hyperliquid 연결', 
        'fail', 
        `연결 실패: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`
      );
    }
  }

  /**
   * Hyperliquid API 연결 테스트
   */
  private async testHyperliquidAPI(): Promise<void> {
    console.log('🔌 Hyperliquid API 테스트 중...');

    try {
      const apiUrl = process.env.HYPERLIQUID_API_URL || 'https://api.hyperliquid-testnet.xyz';
      
      // Meta 정보 요청 테스트
      const response = await fetch(`${apiUrl}/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'meta'
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.addResult(
          'Hyperliquid API', 
          'pass', 
          `API 연결 성공 - 사용 가능한 자산: ${data.universe?.length || 0}개`
        );
      } else {
        this.addResult(
          'Hyperliquid API', 
          'fail', 
          `API 요청 실패: HTTP ${response.status}`
        );
      }
    } catch (_error) {
      this.addResult(
        'Hyperliquid API', 
        'fail', 
        `API 연결 실패: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`
      );
    }
  }

  /**
   * 브릿지 기능 테스트
   */
  private async testBridgeFunctionality(): Promise<void> {
    console.log('🌉 브릿지 기능 테스트 중...');

    try {
      // 테스트 지갑 주소 (실제 거래는 하지 않음)
      const testAddress = '0x742CE0C2c1B3c3b0B71D89B6B15fF1a20D8E9af2';

      // 브릿지 상태 확인 테스트
      const bridgeStatus = await this.bridgeService.checkBridgeStatus(testAddress);
      
      this.addResult(
        '브릿지 상태 확인', 
        'pass', 
        `브릿지 상태 조회 성공 - 잔액: ${bridgeStatus.balance} USDC`
      );

      // 브릿지 검증 테스트
      const validationResult = this.bridgeService.validateBridgeDeposit({
        walletAddress: testAddress,
        amount: '10',
        transactionId: 'test-tx-id',
        arbitrumTxHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      });

      if (validationResult.valid) {
        this.addResult('브릿지 검증', 'pass', '브릿지 요청 검증 성공');
      } else {
        this.addResult('브릿지 검증', 'warning', `검증 경고: ${validationResult.error}`);
      }

      // 브릿지 통계 테스트
      const stats = await this.bridgeService.getBridgeStatistics();
      this.addResult(
        '브릿지 통계', 
        'pass', 
        `통계 조회 성공 - 총 입금: ${stats.totalDeposits}건, 성공률: ${stats.successRate}%`
      );

    } catch (_error) {
      this.addResult(
        '브릿지 기능', 
        'fail', 
        `브릿지 기능 테스트 실패: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`
      );
    }
  }

  /**
   * 지갑 관리 테스트
   */
  private async testWalletManagement(): Promise<void> {
    console.log('👛 지갑 관리 테스트 중...');

    try {
      // 테스트용 지갑 생성
      const testWallet = ethers.Wallet.createRandom();
      
      // 지갑 주소 유효성 검사
      if (ethers.isAddress(testWallet.address)) {
        this.addResult('지갑 생성', 'pass', `테스트 지갑 생성 성공: ${testWallet.address}`);
      } else {
        this.addResult('지갑 생성', 'fail', '지갑 생성 실패');
      }

      // EVM 호환성 테스트
      const isEvmCompatible = testWallet.address.startsWith('0x') && testWallet.address.length === 42;
      
      if (isEvmCompatible) {
        this.addResult('EVM 호환성', 'pass', 'EVM 호환 지갑 주소 형식');
      } else {
        this.addResult('EVM 호환성', 'fail', 'EVM 호환성 문제');
      }

    } catch (_error) {
      this.addResult(
        '지갑 관리', 
        'fail', 
        `지갑 관리 테스트 실패: ${error instanceof Error ? (_error as Error)?.message || String(_error) : 'Unknown error'}`
      );
    }
  }

  /**
   * 테스트 결과 추가
   */
  private addResult(
    component: string, 
    status: 'pass' | 'fail' | 'warning', 
    message: string, 
    details?: any
  ): void {
    this.testResults.push({
      component,
      status,
      message,
      details
    });

    const statusEmoji = {
      pass: '✅',
      fail: '❌',
      warning: '⚠️'
    };

    console.log(`${statusEmoji[status]} ${component}: ${message}`);
  }

  /**
   * 테스트 결과 요약 출력
   */
  printSummary(): void {
    console.log('\n📊 테스트 결과 요약:');
    console.log('==================');
    
    const summary = this.testResults.reduce((acc, result) => {
      acc[result.status]++;
      return acc;
    }, { pass: 0, fail: 0, warning: 0 });

    console.log(`✅ 통과: ${summary.pass}개`);
    console.log(`❌ 실패: ${summary.fail}개`);
    console.log(`⚠️  경고: ${summary.warning}개`);
    console.log(`📝 총 테스트: ${this.testResults.length}개\n`);

    if (summary.fail > 0) {
      console.log('🚨 실패한 테스트들:');
      this.testResults
        .filter(result => result.status === 'fail')
        .forEach(result => {
          console.log(`  - ${result.component}: ${result.message}`);
        });
      console.log('');
    }

    if (summary.warning > 0) {
      console.log('⚠️  경고 사항들:');
      this.testResults
        .filter(result => result.status === 'warning')
        .forEach(result => {
          console.log(`  - ${result.component}: ${result.message}`);
        });
      console.log('');
    }
  }

  /**
   * 테스트용 샘플 트랜잭션 생성
   */
  async createSampleTransaction(): Promise<void> {
    console.log('📝 샘플 트랜잭션 생성 중...');
    
    try {
      // 테스트용 지갑 생성
      const testWallet = ethers.Wallet.createRandom();
      
      // 샘플 브릿지 요청 생성
      const sampleRequest = {
        walletAddress: testWallet.address,
        amount: '10.0',
        transactionId: `test-${Date.now()}`,
        arbitrumTxHash: '0x' + 'a'.repeat(64) // 더미 트랜잭션 해시
      };

      console.log('📋 샘플 트랜잭션 정보:');
      console.log(`  - 지갑: ${sampleRequest.walletAddress}`);
      console.log(`  - 수량: ${sampleRequest.amount} USDC`);
      console.log(`  - TX ID: ${sampleRequest.transactionId}`);
      console.log(`  - Arbitrum TX: ${sampleRequest.arbitrumTxHash}`);

    } catch (_error) {
      console.error('❌ 샘플 트랜잭션 생성 실패:', _error);
    }
  }
}

// 테스트 실행 함수
export async function runWalletTests(): Promise<WalletTestResult[]> {
  const tester = new WalletSystemTester();
  const results = await tester.runCompleteTest();
  tester.printSummary();
  return results;
}

// 샘플 트랜잭션 생성 함수
export async function createSampleTransaction(): Promise<void> {
  const tester = new WalletSystemTester();
  await tester.createSampleTransaction();
}