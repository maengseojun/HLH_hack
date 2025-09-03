'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Zap, 
  Shield, 
  Globe, 
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  Settings
} from 'lucide-react'

interface UniversalAsset {
  symbol: string
  name: string
  totalBalance: number
  totalValueUSD: number
  chainDistribution: ChainAssetInfo[]
  isNative: boolean
  lastUpdated: number
}

interface ChainAssetInfo {
  chainId: string
  chainName: string
  balance: number
  valueUSD: number
  contractAddress: string
  isLocked: boolean
  lastSyncTime: number
}

interface UniversalPosition {
  id: string
  type: 'index' | 'yield' | 'liquidity'
  name: string
  totalValueUSD: number
  performance: {
    totalReturn: number
    dailyReturn: number
    weeklyReturn: number
    maxDrawdown: number
  }
  chainBreakdown: {
    [chainId: string]: {
      valueUSD: number
      percentage: number
      assets: string[]
    }
  }
  autoRebalance: boolean
  lastRebalanced: number
}

interface ChainHealthStatus {
  chainId: string
  chainName: string
  status: 'healthy' | 'congested' | 'offline'
  blockHeight: number
  gasPrice: number
  avgTxTime: number
  lastChecked: number
}

export default function UniversalPortfolioView() {
  const [portfolio, setPortfolio] = useState<{
    totalValueUSD: number
    assets: UniversalAsset[]
    activePositions: UniversalPosition[]
    crossChainHealth: ChainHealthStatus[]
  } | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<UniversalAsset | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchUniversalPortfolio()
  }, [])

  const fetchUniversalPortfolio = async () => {
    setIsLoading(true)
    try {
      // Mock data - 실제로는 Universal Chain Interface 호출
      const mockPortfolio = {
        totalValueUSD: 12450.75,
        assets: [
          {
            symbol: 'ETH',
            name: 'Ethereum',
            totalBalance: 3.25,
            totalValueUSD: 11425.00,
            chainDistribution: [
              {
                chainId: 'ethereum',
                chainName: 'Ethereum',
                balance: 2.1,
                valueUSD: 7385.00,
                contractAddress: 'native',
                isLocked: false,
                lastSyncTime: Date.now()
              },
              {
                chainId: 'hypervm',
                chainName: 'HyperEVM', 
                balance: 1.15,
                valueUSD: 4040.00,
                contractAddress: 'native',
                isLocked: true,
                lastSyncTime: Date.now()
              }
            ],
            isNative: true,
            lastUpdated: Date.now()
          },
          {
            symbol: 'USDC',
            name: 'USD Coin',
            totalBalance: 850.50,
            totalValueUSD: 850.50,
            chainDistribution: [
              {
                chainId: 'polygon',
                chainName: 'Polygon',
                balance: 500.25,
                valueUSD: 500.25,
                contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
                isLocked: false,
                lastSyncTime: Date.now()
              },
              {
                chainId: 'bsc',
                chainName: 'BSC',
                balance: 350.25,
                valueUSD: 350.25,
                contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
                isLocked: false,
                lastSyncTime: Date.now()
              }
            ],
            isNative: false,
            lastUpdated: Date.now()
          },
          {
            symbol: 'SOL',
            name: 'Solana',
            totalBalance: 1.45,
            totalValueUSD: 175.25,
            chainDistribution: [
              {
                chainId: 'solana',
                chainName: 'Solana',
                balance: 1.45,
                valueUSD: 175.25,
                contractAddress: 'So11111111111111111111111111111111111111112',
                isLocked: false,
                lastSyncTime: Date.now()
              }
            ],
            isNative: false,
            lastUpdated: Date.now()
          }
        ],
        activePositions: [
          {
            id: 'pos_meme_index',
            type: 'index' as const,
            name: 'HYPER_MEME_INDEX',
            totalValueUSD: 1250.50,
            performance: {
              totalReturn: 15.2,
              dailyReturn: 2.1,
              weeklyReturn: 8.5,
              maxDrawdown: -12.3
            },
            chainBreakdown: {
              'hypervm': { valueUSD: 625.25, percentage: 50, assets: ['WIF', 'BONK'] },
              'solana': { valueUSD: 375.15, percentage: 30, assets: ['BOME', 'MEW'] },
              'bsc': { valueUSD: 250.10, percentage: 20, assets: ['BABYDOGE'] }
            },
            autoRebalance: true,
            lastRebalanced: Date.now() - 3600000
          }
        ],
        crossChainHealth: [
          {
            chainId: 'hypervm',
            chainName: 'HyperEVM',
            status: 'healthy' as const,
            blockHeight: 31251854,
            gasPrice: 15,
            avgTxTime: 3,
            lastChecked: Date.now()
          },
          {
            chainId: 'ethereum',
            chainName: 'Ethereum',
            status: 'congested' as const,
            blockHeight: 21234567,
            gasPrice: 45,
            avgTxTime: 25,
            lastChecked: Date.now()
          },
          {
            chainId: 'polygon',
            chainName: 'Polygon',
            status: 'healthy' as const,
            blockHeight: 62345678,
            gasPrice: 32,
            avgTxTime: 4,
            lastChecked: Date.now()
          }
        ]
      }

      setPortfolio(mockPortfolio)
    } catch (error) {
      console.error('Failed to fetch portfolio:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!portfolio) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
        <div className="max-w-6xl mx-auto text-center">
          <AlertTriangle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Portfolio Not Available</h2>
          <p className="text-gray-600">Unable to load your universal portfolio data.</p>
          <Button onClick={fetchUniversalPortfolio} className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              🌐 Universal Portfolio
            </h1>
            <p className="text-gray-600 mt-1">All chains, unified view</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {portfolio.crossChainHealth.length} Chains
            </Badge>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Portfolio Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-500" />
                Total Portfolio Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900 mb-2">
                ${portfolio.totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-green-600">+12.5% (24h)</span>
                <span className="text-gray-500">• +$1,385.50</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-500" />
                Active Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {portfolio.activePositions.length}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Across {Object.keys(portfolio.activePositions[0]?.chainBreakdown || {}).length} chains
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                Network Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {portfolio.crossChainHealth.filter(c => c.status === 'healthy').length}/{portfolio.crossChainHealth.length}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Healthy networks
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="assets" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="health">Network Health</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Assets Tab */}
          <TabsContent value="assets" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Assets List */}
              <Card>
                <CardHeader>
                  <CardTitle>Cross-Chain Assets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {portfolio.assets.map((asset, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedAsset?.symbol === asset.symbol
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-gray-100 hover:border-gray-200'
                        }`}
                        onClick={() => setSelectedAsset(asset)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold">
                              {asset.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <div className="font-medium">{asset.symbol}</div>
                              <div className="text-sm text-gray-500">{asset.name}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">${asset.totalValueUSD.toLocaleString()}</div>
                            <div className="text-sm text-gray-500">{asset.totalBalance.toFixed(4)}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {asset.isNative && (
                              <Badge variant="secondary" className="text-xs">Native</Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {asset.chainDistribution.length} chains
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1">
                            {asset.chainDistribution.some(c => c.isLocked) && (
                              <Badge variant="destructive" className="text-xs">Locked</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Asset Detail */}
              <Card>
                <CardHeader>
                  <CardTitle>
                    {selectedAsset ? `${selectedAsset.symbol} Distribution` : 'Select an Asset'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedAsset ? (
                    <div className="space-y-4">
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <div className="text-2xl font-bold">${selectedAsset.totalValueUSD.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">{selectedAsset.totalBalance.toFixed(6)} {selectedAsset.symbol}</div>
                      </div>
                      
                      <div className="space-y-3">
                        {selectedAsset.chainDistribution.map((chain, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
                                {chain.chainName.slice(0, 2)}
                              </div>
                              <div>
                                <div className="font-medium">{chain.chainName}</div>
                                <div className="text-xs text-gray-500">
                                  {chain.isLocked ? 'Locked in SCV' : 'Available'}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">${chain.valueUSD.toLocaleString()}</div>
                              <div className="text-sm text-gray-500">{chain.balance.toFixed(4)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Select an asset to view its cross-chain distribution</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Positions Tab */}
          <TabsContent value="positions" className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {portfolio.activePositions.map((position, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Badge variant="outline">{position.type}</Badge>
                        {position.name}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {position.autoRebalance && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Zap className="h-3 w-3" />
                            Auto
                          </Badge>
                        )}
                        <div className="text-right">
                          <div className="font-medium">${position.totalValueUSD.toLocaleString()}</div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Performance Metrics */}
                      <div className="space-y-3">
                        <h4 className="font-medium">Performance</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 bg-green-50 rounded-lg">
                            <div className="text-sm text-gray-600">Total Return</div>
                            <div className="flex items-center gap-1">
                              <ArrowUpRight className="h-4 w-4 text-green-500" />
                              <span className="font-bold text-green-600">+{position.performance.totalReturn}%</span>
                            </div>
                          </div>
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <div className="text-sm text-gray-600">Daily Return</div>
                            <div className="flex items-center gap-1">
                              <ArrowUpRight className="h-4 w-4 text-blue-500" />
                              <span className="font-bold text-blue-600">+{position.performance.dailyReturn}%</span>
                            </div>
                          </div>
                          <div className="p-3 bg-purple-50 rounded-lg">
                            <div className="text-sm text-gray-600">Weekly Return</div>
                            <div className="flex items-center gap-1">
                              <ArrowUpRight className="h-4 w-4 text-purple-500" />
                              <span className="font-bold text-purple-600">+{position.performance.weeklyReturn}%</span>
                            </div>
                          </div>
                          <div className="p-3 bg-red-50 rounded-lg">
                            <div className="text-sm text-gray-600">Max Drawdown</div>
                            <div className="flex items-center gap-1">
                              <ArrowDownRight className="h-4 w-4 text-red-500" />
                              <span className="font-bold text-red-600">{position.performance.maxDrawdown}%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Chain Breakdown */}
                      <div className="space-y-3">
                        <h4 className="font-medium">Chain Distribution</h4>
                        <div className="space-y-2">
                          {Object.entries(position.chainBreakdown).map(([chainId, info]) => (
                            <div key={chainId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center text-white text-xs font-bold">
                                  {chainId.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium">{chainId}</span>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-medium">${info.valueUSD.toLocaleString()}</div>
                                <div className="text-xs text-gray-500">{info.percentage}%</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500">
                          Last rebalanced: {new Date(position.lastRebalanced).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Network Health Tab */}
          <TabsContent value="health" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {portfolio.crossChainHealth.map((chain, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{chain.chainName}</span>
                      <Badge 
                        variant={chain.status === 'healthy' ? 'default' : 
                               chain.status === 'congested' ? 'secondary' : 'destructive'}
                        className="flex items-center gap-1"
                      >
                        {chain.status === 'healthy' && <CheckCircle2 className="h-3 w-3" />}
                        {chain.status === 'congested' && <Clock className="h-3 w-3" />}
                        {chain.status === 'offline' && <AlertTriangle className="h-3 w-3" />}
                        {chain.status}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Block Height</span>
                        <span className="font-mono text-sm">{chain.blockHeight.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Gas Price</span>
                        <span className="font-mono text-sm">{chain.gasPrice} gwei</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Avg Tx Time</span>
                        <span className="font-mono text-sm">{chain.avgTxTime}s</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Last Checked</span>
                        <span className="font-mono text-xs text-gray-500">
                          {new Date(chain.lastChecked).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                      <div className="text-3xl font-bold mb-2">95.2%</div>
                      <div className="text-sm text-gray-600">Cross-chain sync accuracy</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-xl font-bold text-green-600">$234.50</div>
                        <div className="text-xs text-gray-600">Gas saved (30d)</div>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">12.3s</div>
                        <div className="text-xs text-gray-600">Avg execution time</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">Auto-rebalance completed</div>
                          <div className="text-xs text-gray-500">HYPER_MEME_INDEX</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">2h ago</div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Activity className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">Cross-chain sync</div>
                          <div className="text-xs text-gray-500">All chains updated</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">5m ago</div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <Zap className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">Gas optimization</div>
                          <div className="text-xs text-gray-500">Saved $12.50</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">1h ago</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}