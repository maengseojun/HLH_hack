'use client';

import React, { useState, useEffect } from 'react';
// Dynamic import workaround for Privy hooks
const { usePrivy, useWallets } = require('@privy-io/react-auth');
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  Wallet,
  Network,
  Link, // Link 대신 Link 사용
  Shield,
  Settings
} from 'lucide-react';

interface TestResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

export default function TestWalletSystemPage() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();
  
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  // 테스트 실행
  const runTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);

    const results: TestResult[] = [];

    // 1. Privy 연결 테스트
    results.push({
      component: 'Privy 연결',
      status: ready ? 'pass' : 'fail',
      message: ready ? 'Privy 클라이언트 준비 완료' : 'Privy 클라이언트 준비 중'
    });

    // 2. 인증 상태 테스트
    if (ready) {
      results.push({
        component: '사용자 인증',
        status: authenticated ? 'pass' : 'warning',
        message: authenticated ? '사용자 인증됨' : '인증되지 않음',
        details: user ? {
          id: user.id,
          email: user.email?.address,
          walletAddress: user.wallet?.address
        } : null
      });
    }

    // 3. 지갑 연결 테스트
    if (wallets.length > 0) {
      results.push({
        component: '지갑 연결',
        status: 'pass',
        message: `${wallets.length}개 지갑 연결됨`,
        details: wallets.map(wallet => ({
          address: wallet.address,
          walletClientType: wallet.walletClientType,
          connectorType: wallet.connectorType
        }))
      });
    } else {
      results.push({
        component: '지갑 연결',
        status: authenticated ? 'warning' : 'fail',
        message: '연결된 지갑 없음'
      });
    }

    // 4. 네트워크 연결 테스트
    await testNetworkConnections(results);

    // 5. Hyperliquid API 테스트
    await testHyperliquidAPI(results);

    // 6. 브릿지 기능 테스트
    await testLinkFunctionality(results);

    setTestResults(results);
    setIsRunningTests(false);
  };

  // 네트워크 연결 테스트
  const testNetworkConnections = async (results: TestResult[]) => {
    const networks = [
      {
        name: 'Arbitrum Sepolia',
        rpc: 'https://arbitrum-sepolia.public.blastapi.io',
        chainId: 421614
      },
      {
        name: 'Hyperliquid Testnet',
        rpc: 'https://rpc.hyperliquid-testnet.xyz/evm',
        chainId: 998
      }
    ];

    for (const network of networks) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(network.rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_chainId',
            params: [],
            id: 1
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const returnedChainId = parseInt(data.result, 16);
          
          if (returnedChainId === network.chainId) {
            results.push({
              component: `${network.name} 연결`,
              status: 'pass',
              message: `연결 성공 (Chain ID: ${returnedChainId})`
            });
          } else {
            results.push({
              component: `${network.name} 연결`,
              status: 'warning',
              message: `체인 ID 불일치: 예상 ${network.chainId}, 실제 ${returnedChainId}`
            });
          }
        } else {
          results.push({
            component: `${network.name} 연결`,
            status: 'fail',
            message: `HTTP ${response.status} 오류`
          });
        }
      } catch (error) {
        results.push({
          component: `${network.name} 연결`,
          status: 'fail',
          message: error instanceof Error ? error.message : '연결 실패'
        });
      }
    }
  };

  // Hyperliquid API 테스트
  const testHyperliquidAPI = async (results: TestResult[]) => {
    try {
      const response = await fetch('https://api.hyperliquid-testnet.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta' })
      });

      if (response.ok) {
        const data = await response.json();
        results.push({
          component: 'Hyperliquid API',
          status: 'pass',
          message: `API 연결 성공 - ${data.universe?.length || 0}개 자산 확인`,
          details: data.universe?.slice(0, 5) // 처음 5개만 표시
        });
      } else {
        results.push({
          component: 'Hyperliquid API',
          status: 'fail',
          message: `API 호출 실패: HTTP ${response.status}`
        });
      }
    } catch (error) {
      results.push({
        component: 'Hyperliquid API',
        status: 'fail',
        message: error instanceof Error ? error.message : 'API 연결 실패'
      });
    }
  };

  // 브릿지 기능 테스트
  const testLinkFunctionality = async (results: TestResult[]) => {
    try {
      // 테스트 주소로 브릿지 상태 확인
      const testAddress = '0x742CE0C2c1B3c3b0B71D89B6B15fF1a20D8E9af2';
      
      const response = await fetch('https://api.hyperliquid-testnet.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'clearinghouseState',
          user: testAddress
        })
      });

      if (response.ok) {
        const data = await response.json();
        results.push({
          component: '브릿지 상태 확인',
          status: 'pass',
          message: '브릿지 상태 조회 성공',
          details: {
            marginSummary: data.marginSummary,
            crossMaintenanceMarginUsed: data.crossMaintenanceMarginUsed
          }
        });
      } else {
        results.push({
          component: '브릿지 상태 확인',
          status: 'warning',
          message: '브릿지 상태 조회 실패 (테스트 주소 문제일 수 있음)'
        });
      }
    } catch (error) {
      results.push({
        component: '브릿지 상태 확인',
        status: 'fail',
        message: error instanceof Error ? error.message : '브릿지 테스트 실패'
      });
    }
  };

  // 상태별 아이콘 반환
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Loader2 className="w-4 h-4 animate-spin" />;
    }
  };

  // 상태별 배지 색상
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pass':
        return 'default'; // 초록색
      case 'fail':
        return 'destructive'; // 빨간색
      case 'warning':
        return 'secondary'; // 노란색
      default:
        return 'outline';
    }
  };

  // 요약 통계
  const summary = testResults.reduce((acc, result) => {
    acc[result.status]++;
    return acc;
  }, { pass: 0, fail: 0, warning: 0 });

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">지갑 시스템 테스트</h1>
        <p className="text-muted-foreground">
          Privy, Hyperliquid, 브릿지 기능의 통합 테스트 및 상태 확인
        </p>
      </div>

      {/* 실행 버튼 */}
      <div className="mb-6">
        <Button 
          onClick={runTests} 
          disabled={isRunningTests}
          size="lg"
          className="mr-4"
        >
          {isRunningTests ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              테스트 실행 중...
            </>
          ) : (
            <>
              <Settings className="w-4 h-4 mr-2" />
              전체 테스트 실행
            </>
          )}
        </Button>

        {!authenticated && (
          <Button onClick={login} variant="outline">
            <Wallet className="w-4 h-4 mr-2" />
            로그인하여 테스트
          </Button>
        )}
      </div>

      {/* 테스트 결과 요약 */}
      {testResults.length > 0 && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">총 테스트</p>
                  <p className="text-2xl font-bold">{testResults.length}</p>
                </div>
                <Settings className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">통과</p>
                  <p className="text-2xl font-bold text-green-600">{summary.pass}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">경고</p>
                  <p className="text-2xl font-bold text-yellow-600">{summary.warning}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">실패</p>
                  <p className="text-2xl font-bold text-red-600">{summary.fail}</p>
                </div>
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">
            <Shield className="w-4 h-4 mr-2" />
            개요
          </TabsTrigger>
          <TabsTrigger value="network">
            <Network className="w-4 h-4 mr-2" />
            네트워크
          </TabsTrigger>
          <TabsTrigger value="bridge">
            <Link className="w-4 h-4 mr-2" />
            브릿지
          </TabsTrigger>
          <TabsTrigger value="wallet">
            <Wallet className="w-4 h-4 mr-2" />
            지갑
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>전체 테스트 결과</CardTitle>
              <CardDescription>
                시스템의 모든 구성 요소에 대한 테스트 결과
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {testResults.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    테스트를 실행하려면 "전체 테스트 실행" 버튼을 클릭하세요.
                  </AlertDescription>
                </Alert>
              ) : (
                testResults.map((result, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{result.component}</h4>
                        <Badge variant={getStatusBadgeVariant(result.status)}>
                          {result.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            세부 정보 보기
                          </summary>
                          <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>네트워크 연결 상태</CardTitle>
              <CardDescription>
                Arbitrum과 Hyperliquid 네트워크 연결 테스트
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testResults
                .filter(result => result.component.includes('연결'))
                .map((result, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <h4 className="font-medium">{result.component}</h4>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(result.status)}>
                      {result.status}
                    </Badge>
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bridge" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>브릿지 기능 테스트</CardTitle>
              <CardDescription>
                Arbitrum ↔ Hyperliquid 브릿지 연결 및 상태 확인
              </CardDescription>
            </CardHeader>
            <CardContent>
              {testResults
                .filter(result => result.component.includes('브릿지') || result.component.includes('API'))
                .map((result, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <h4 className="font-medium">{result.component}</h4>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            세부 정보 보기
                          </summary>
                          <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <Badge variant={getStatusBadgeVariant(result.status)}>
                      {result.status}
                    </Badge>
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>지갑 및 인증 상태</CardTitle>
              <CardDescription>
                Privy 인증 및 지갑 연결 상태 확인
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 현재 사용자 정보 */}
              {authenticated && user && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">현재 사용자 정보</h4>
                  <div className="text-sm space-y-1">
                    <p><strong>ID:</strong> {user.id}</p>
                    {user.email && <p><strong>이메일:</strong> {user.email.address}</p>}
                    {user.wallet && <p><strong>지갑:</strong> {user.wallet.address}</p>}
                    <p><strong>연결된 지갑 수:</strong> {wallets.length}</p>
                  </div>
                </div>
              )}

              {/* 지갑 관련 테스트 결과 */}
              {testResults
                .filter(result => 
                  result.component.includes('Privy') || 
                  result.component.includes('인증') || 
                  result.component.includes('지갑')
                )
                .map((result, index) => (
                  <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <h4 className="font-medium">{result.component}</h4>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            세부 정보 보기
                          </summary>
                          <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <Badge variant={getStatusBadgeVariant(result.status)}>
                      {result.status}
                    </Badge>
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}