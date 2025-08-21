'use client';

/**
 * 🚀 대량 주문 시뮬레이터 UI
 * 초당 900개+ 주문 성능 테스트 컨트롤 패널
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

interface SimulationConfig {
  totalOrders: number;
  ordersPerSecond: number;
  batchSize: number;
  orderTypes: {
    market: number;
    limit: number;
  };
  sides: {
    buy: number;
    sell: number;
  };
  amountRange: {
    min: number;
    max: number;
  };
  priceRange: {
    min: number;
    max: number;
  };
  useV2Router: boolean;
  // 🆕 현실적 패턴 설정 추가
  patternMode: 'uniform' | 'realistic' | 'burst';
  burstIntensity: number; // 1-10 스케일
  // 🚀 Ultra 모드 추가
  useUltraMode: boolean;
}

interface SimulationStats {
  totalOrders: number;
  completedOrders: number;
  successfulOrders: number;
  failedOrders: number;
  averageResponseTime: number;
  actualTPS: number;
  startTime: number;
  endTime?: number;
  errors: Record<string, number>;
}

export default function TradingSimulatorPage() {
  const [config, setConfig] = useState<SimulationConfig>({
    totalOrders: 1000,
    ordersPerSecond: 900,
    batchSize: 50,
    orderTypes: { market: 0.7, limit: 0.3 },
    sides: { buy: 0.5, sell: 0.5 },
    amountRange: { min: 1, max: 1000 },
    priceRange: { min: 0.5, max: 1.5 },
    useV2Router: true,
    patternMode: 'realistic',
    burstIntensity: 7,
    useUltraMode: false
  });

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SimulationStats | null>(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [redisStatus, setRedisStatus] = useState<{
    connected: boolean;
    mode: string;
    estimatedTPS: number;
    message: string;
  } | null>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-49), `${timestamp}: ${message}`]);
  };

  // Redis 상태 확인
  const checkRedisStatus = async () => {
    try {
      const response = await fetch('/api/redis/ultra-status');
      const result = await response.json();
      
      if (result.success) {
        setRedisStatus({
          connected: result.redis.connected,
          mode: result.redis.mode,
          estimatedTPS: result.ultraMode.estimatedTPS,
          message: result.redis.message
        });
      }
    } catch (error) {
      console.error('Failed to check Redis status:', error);
      setRedisStatus({
        connected: false,
        mode: 'error',
        estimatedTPS: 500,
        message: 'Unable to check Redis status'
      });
    }
  };

  // 컴포넌트 마운트 시 Redis 상태 확인
  useEffect(() => {
    checkRedisStatus();
  }, []);

  // Ultra 모드 전환 시 Redis 상태 재확인
  useEffect(() => {
    if (config.useUltraMode) {
      checkRedisStatus();
    }
  }, [config.useUltraMode]);

  const handleStartSimulation = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setResults(null);
    setProgress(0);
    setLogs([]);
    
    addLog(`🚀 Starting simulation: ${config.totalOrders} orders at ${config.ordersPerSecond} TPS`);

    try {
      // Ultra 모드에 따라 다른 엔드포인트 사용
      const endpoint = config.useUltraMode ? '/api/trading/ultra-simulator' : '/api/trading/simulator';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev-token'
        },
        body: JSON.stringify(config)
      });

      const result = await response.json();
      
      if (result.success) {
        setResults(result.results);
        addLog(`✅ Simulation completed successfully`);
        addLog(`📊 Actual TPS: ${result.results.actualTPS.toFixed(1)}`);
        addLog(`📈 Success Rate: ${((result.results.successfulOrders / result.results.totalOrders) * 100).toFixed(1)}%`);
      } else {
        addLog(`❌ Simulation failed: ${result.error}`);
      }
    } catch (error) {
      addLog(`💥 Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
      setProgress(100);
    }
  };

  const handleResetConfig = () => {
    const ultraMode = config.useUltraMode;
    setConfig({
      totalOrders: ultraMode ? 5000 : 1000,
      ordersPerSecond: ultraMode ? 2000 : 900,
      batchSize: ultraMode ? 100 : 50,
      orderTypes: { market: ultraMode ? 0.8 : 0.7, limit: ultraMode ? 0.2 : 0.3 },
      sides: { buy: 0.5, sell: 0.5 },
      amountRange: { min: 1, max: ultraMode ? 500 : 1000 },
      priceRange: { min: ultraMode ? 0.8 : 0.5, max: ultraMode ? 1.2 : 1.5 },
      useV2Router: true,
      patternMode: ultraMode ? 'burst' : 'realistic',
      burstIntensity: ultraMode ? 8 : 7,
      useUltraMode: ultraMode
    });
  };

  // 시뮬레이션 진행 상황 추정
  useEffect(() => {
    if (!isRunning || !results) return;
    
    const interval = setInterval(() => {
      if (results && results.endTime) {
        setProgress(100);
        clearInterval(interval);
      } else {
        // 예상 진행률 계산
        const estimatedDuration = config.totalOrders / config.ordersPerSecond * 1000;
        const elapsed = Date.now() - (results?.startTime || Date.now());
        const estimatedProgress = Math.min(95, (elapsed / estimatedDuration) * 100);
        setProgress(estimatedProgress);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, results, config]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">🚀 Trading Simulator</h1>
          <p className="text-gray-600 mt-2">
            {config.useUltraMode ? 
              'Ultra-High Performance Testing (Target: 15,000+ TPS)' : 
              'Mass order performance testing (Target: 900+ TPS)'
            }
          </p>
          <div className="mt-3 text-sm">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              🔄 Redis Fallback Mode Available
            </span>
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ⚡ Async DB Writes
            </span>
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              🎯 Realistic Patterns
            </span>
            {config.useUltraMode && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                🚀 ULTRA MODE
              </span>
            )}
            {redisStatus && (
              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                redisStatus.mode === 'redis' ? 'bg-green-100 text-green-800' : 
                redisStatus.mode === 'fallback' ? 'bg-yellow-100 text-yellow-800' : 
                'bg-red-100 text-red-800'
              }`}>
                {redisStatus.mode === 'redis' ? '⚡ Redis Connected' : 
                 redisStatus.mode === 'fallback' ? '🔄 Fallback Mode' : 
                 '❌ Redis Error'}
                {config.useUltraMode && ` (~${redisStatus.estimatedTPS.toLocaleString()} TPS)`}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 설정 패널 */}
          <Card>
            <CardHeader>
              <CardTitle>Simulation Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 기본 설정 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="totalOrders">Total Orders</Label>
                  <Input
                    id="totalOrders"
                    type="number"
                    value={config.totalOrders}
                    onChange={(e) => setConfig(prev => ({ ...prev, totalOrders: parseInt(e.target.value) || 0 }))}
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <Label htmlFor="ordersPerSecond">Target TPS</Label>
                  <Input
                    id="ordersPerSecond"
                    type="number"
                    value={config.ordersPerSecond}
                    onChange={(e) => setConfig(prev => ({ ...prev, ordersPerSecond: parseInt(e.target.value) || 0 }))}
                    disabled={isRunning}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="batchSize">Batch Size</Label>
                <Input
                  id="batchSize"
                  type="number"
                  value={config.batchSize}
                  onChange={(e) => setConfig(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 0 }))}
                  disabled={isRunning}
                />
              </div>

              {/* 주문 타입 비율 */}
              <div className="space-y-2">
                <Label>Order Types</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="marketRatio" className="text-sm">Market Orders (%)</Label>
                    <Input
                      id="marketRatio"
                      type="number"
                      min="0"
                      max="100"
                      value={Math.round(config.orderTypes.market * 100)}
                      onChange={(e) => {
                        const market = parseInt(e.target.value) / 100;
                        setConfig(prev => ({ 
                          ...prev, 
                          orderTypes: { market, limit: 1 - market }
                        }));
                      }}
                      disabled={isRunning}
                    />
                  </div>
                  <div>
                    <Label htmlFor="limitRatio" className="text-sm">Limit Orders (%)</Label>
                    <Input
                      id="limitRatio"
                      type="number"
                      value={Math.round(config.orderTypes.limit * 100)}
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* 매수/매도 비율 */}
              <div className="space-y-2">
                <Label>Order Sides</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="buyRatio" className="text-sm">Buy Orders (%)</Label>
                    <Input
                      id="buyRatio"
                      type="number"
                      min="0"
                      max="100"
                      value={Math.round(config.sides.buy * 100)}
                      onChange={(e) => {
                        const buy = parseInt(e.target.value) / 100;
                        setConfig(prev => ({ 
                          ...prev, 
                          sides: { buy, sell: 1 - buy }
                        }));
                      }}
                      disabled={isRunning}
                    />
                  </div>
                  <div>
                    <Label htmlFor="sellRatio" className="text-sm">Sell Orders (%)</Label>
                    <Input
                      id="sellRatio"
                      type="number"
                      value={Math.round(config.sides.sell * 100)}
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* 수량/가격 범위 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Amount Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={config.amountRange.min}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        amountRange: { ...prev.amountRange, min: parseFloat(e.target.value) || 0 }
                      }))}
                      disabled={isRunning}
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={config.amountRange.max}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        amountRange: { ...prev.amountRange, max: parseFloat(e.target.value) || 0 }
                      }))}
                      disabled={isRunning}
                    />
                  </div>
                </div>
                <div>
                  <Label>Price Range (Limit Orders)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Min"
                      value={config.priceRange.min}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        priceRange: { ...prev.priceRange, min: parseFloat(e.target.value) || 0 }
                      }))}
                      disabled={isRunning}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Max"
                      value={config.priceRange.max}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        priceRange: { ...prev.priceRange, max: parseFloat(e.target.value) || 0 }
                      }))}
                      disabled={isRunning}
                    />
                  </div>
                </div>
              </div>

              {/* 패턴 모드 선택 */}
              <div className="space-y-2">
                <Label>Order Pattern Mode</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'uniform', label: 'Uniform', desc: '일정한 간격' },
                    { value: 'realistic', label: 'Realistic', desc: '실제 거래소 패턴' },
                    { value: 'burst', label: 'Burst', desc: '집중 버스트' }
                  ].map((mode) => (
                    <div key={mode.value} className="text-center">
                      <input
                        type="radio"
                        id={`pattern-${mode.value}`}
                        name="patternMode"
                        value={mode.value}
                        checked={config.patternMode === mode.value}
                        onChange={(e) => setConfig(prev => ({ ...prev, patternMode: e.target.value as any }))}
                        disabled={isRunning}
                        className="mb-1"
                      />
                      <Label htmlFor={`pattern-${mode.value}`} className="block text-sm font-medium">
                        {mode.label}
                      </Label>
                      <div className="text-xs text-gray-500">{mode.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 버스트 강도 */}
              {config.patternMode !== 'uniform' && (
                <div>
                  <Label htmlFor="burstIntensity">
                    Burst Intensity: {config.burstIntensity}/10
                  </Label>
                  <Input
                    id="burstIntensity"
                    type="range"
                    min="1"
                    max="10"
                    value={config.burstIntensity}
                    onChange={(e) => setConfig(prev => ({ ...prev, burstIntensity: parseInt(e.target.value) }))}
                    disabled={isRunning}
                    className="mt-1"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {config.burstIntensity <= 3 ? '낮은 변동성' : 
                     config.burstIntensity <= 7 ? '보통 변동성' : 
                     '높은 변동성'}
                  </div>
                </div>
              )}

              {/* Ultra 모드 선택 */}
              <div className="p-4 border-2 border-red-200 rounded-lg bg-red-50">
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    id="useUltraMode"
                    checked={config.useUltraMode}
                    onChange={(e) => {
                      const ultraMode = e.target.checked;
                      setConfig(prev => ({
                        ...prev,
                        useUltraMode: ultraMode,
                        // Ultra 모드 시 기본값 조정
                        totalOrders: ultraMode ? 5000 : 1000,
                        ordersPerSecond: ultraMode ? 2000 : 900,
                        batchSize: ultraMode ? 100 : 50,
                        orderTypes: { 
                          market: ultraMode ? 0.8 : 0.7, 
                          limit: ultraMode ? 0.2 : 0.3 
                        },
                        patternMode: ultraMode ? 'burst' : 'realistic',
                        burstIntensity: ultraMode ? 8 : 7
                      }));
                    }}
                    disabled={isRunning}
                  />
                  <Label htmlFor="useUltraMode" className="font-bold text-red-800">
                    🚀 ULTRA Mode (15K+ TPS)
                  </Label>
                </div>
                <div className="text-xs text-red-600">
                  {config.useUltraMode ? 
                    '⚡ Redis Lua Scripts + High-Performance Orderbook + Batch Processing' :
                    'Standard simulation with V2 router'
                  }
                </div>
              </div>

              {/* 라우터 선택 */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useV2Router"
                  checked={config.useV2Router}
                  onChange={(e) => setConfig(prev => ({ ...prev, useV2Router: e.target.checked }))}
                  disabled={isRunning || config.useUltraMode}
                />
                <Label htmlFor="useV2Router">
                  Use V2 Hybrid Router {config.useUltraMode && '(Auto-enabled in Ultra Mode)'}
                </Label>
              </div>

              {/* 컨트롤 버튼 */}
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleStartSimulation} 
                  disabled={isRunning}
                  className="flex-1"
                >
                  {isRunning ? '🔄 Running...' : '🚀 Start Simulation'}
                </Button>
                <Button 
                  onClick={handleResetConfig} 
                  variant="outline"
                  disabled={isRunning}
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 결과 및 모니터링 패널 */}
          <div className="space-y-6">
            {/* 진행 상황 */}
            <Card>
              <CardHeader>
                <CardTitle>Simulation Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Progress value={progress} className="w-full" />
                  <div className="text-sm text-gray-600">
                    {isRunning ? `Running... ${progress.toFixed(1)}%` : 
                     results ? 'Completed' : 'Ready to start'}
                  </div>
                  
                  {/* 예상 시간 */}
                  {isRunning && (
                    <div className="text-sm">
                      Estimated duration: {(config.totalOrders / config.ordersPerSecond).toFixed(1)}s
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 결과 통계 */}
            {results && (
              <Card>
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Total Orders:</div>
                      <div>{results.totalOrders.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="font-medium">Successful:</div>
                      <div className="text-green-600">{results.successfulOrders.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="font-medium">Failed:</div>
                      <div className="text-red-600">{results.failedOrders.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="font-medium">Success Rate:</div>
                      <div>{((results.successfulOrders / results.totalOrders) * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="font-medium">Actual TPS:</div>
                      <div className="text-blue-600 font-bold">{results.actualTPS.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="font-medium">Avg Response:</div>
                      <div>{results.averageResponseTime.toFixed(1)}ms</div>
                    </div>
                    <div>
                      <div className="font-medium">Duration:</div>
                      <div>{results.endTime ? ((results.endTime - results.startTime) / 1000).toFixed(1) : '0'}s</div>
                    </div>
                  </div>

                  {/* 에러 분석 */}
                  {Object.keys(results.errors).length > 0 && (
                    <div className="mt-4">
                      <div className="font-medium mb-2">Error Analysis:</div>
                      <div className="text-xs space-y-1">
                        {Object.entries(results.errors).map(([error, count]) => (
                          <div key={error} className="flex justify-between">
                            <span className="text-red-600 truncate">{error}</span>
                            <span>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 실시간 로그 */}
            <Card>
              <CardHeader>
                <CardTitle>Simulation Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-black text-green-400 p-3 rounded font-mono text-xs h-64 overflow-y-auto">
                  {logs.length === 0 ? (
                    <div className="text-gray-500">Logs will appear here...</div>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index}>{log}</div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}