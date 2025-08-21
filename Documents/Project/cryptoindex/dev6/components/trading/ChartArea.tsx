'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart3, 
  TrendingUp, 
  Maximize2, 
  Settings,
  BarChart2
} from 'lucide-react'

interface ChartAreaProps {
  selectedIndex: string
}

// Mock 차트 데이터
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w']
const CHART_TYPES = ['Candlestick', 'Line', 'Area', 'HeikinAshi']

export default function ChartArea({ selectedIndex }: ChartAreaProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h')
  const [selectedChartType, setSelectedChartType] = useState('Candlestick')

  return (
    <div className="h-full flex flex-col bg-slate-900">
      
      {/* 차트 상단 컨트롤 */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center space-x-4">
          
          {/* 시간대 선택 */}
          <div className="flex items-center space-x-1">
            {TIMEFRAMES.map((timeframe) => (
              <Button
                key={timeframe}
                variant={selectedTimeframe === timeframe ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTimeframe(timeframe)}
                className="text-xs h-8 px-2"
              >
                {timeframe}
              </Button>
            ))}
          </div>

          {/* 차트 타입 */}
          <div className="flex items-center space-x-2 border-l border-slate-700 pl-4">
            <BarChart2 className="w-4 h-4 text-slate-400" />
            <select 
              value={selectedChartType}
              onChange={(e) => setSelectedChartType(e.target.value)}
              className="bg-slate-800 text-white text-sm border border-slate-600 rounded px-2 py-1"
            >
              {CHART_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

        </div>

        <div className="flex items-center space-x-2">
          {/* 실시간 정보 */}
          <Badge variant="outline" className="text-green-400 border-green-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2" />
            LIVE
          </Badge>
          
          <Button variant="ghost" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
          
          <Button variant="ghost" size="sm">
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 메인 차트 영역 */}
      <div className="flex-1 relative bg-slate-950">
        
        {/* Mock 차트 (TradingView 스타일) */}
        <div className="absolute inset-4">
          
          {/* 차트 오버레이 정보 */}
          <div className="absolute top-4 left-4 z-10 bg-slate-900/80 rounded-lg p-3 backdrop-blur-sm">
            <div className="text-lg font-bold text-white">$42.85</div>
            <div className="text-sm text-green-400">+12.34% (+$4.73)</div>
            <div className="text-xs text-slate-400 mt-1">
              O: $38.12 | H: $43.21 | L: $37.89 | C: $42.85
            </div>
            <div className="text-xs text-slate-400">
              Volume: 2.84M | {selectedTimeframe} | {new Date().toLocaleTimeString()}
            </div>
          </div>

          {/* Mock 차트 그리드 */}
          <div className="w-full h-full relative overflow-hidden">
            <svg className="w-full h-full">
              {/* 그리드 라인 */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* Mock 캔들스틱 차트 */}
              <g>
                {Array.from({length: 50}, (_, i) => {
                  const x = (i * 20) + 40
                  const basePrice = 400 + Math.sin(i * 0.3) * 50 + Math.random() * 40
                  const high = basePrice + Math.random() * 20
                  const low = basePrice - Math.random() * 20
                  const open = basePrice + (Math.random() - 0.5) * 10
                  const close = basePrice + (Math.random() - 0.5) * 10
                  const isGreen = close > open
                  
                  return (
                    <g key={i}>
                      {/* 심지 */}
                      <line 
                        x1={x} y1={high} x2={x} y2={low} 
                        stroke={isGreen ? '#10b981' : '#ef4444'} 
                        strokeWidth="1"
                      />
                      {/* 캔들 몸체 */}
                      <rect 
                        x={x-6} 
                        y={Math.min(open, close)} 
                        width="12" 
                        height={Math.abs(close - open) || 2}
                        fill={isGreen ? '#10b981' : '#ef4444'}
                        stroke={isGreen ? '#10b981' : '#ef4444'}
                      />
                    </g>
                  )
                })}
              </g>
            </svg>

            {/* 가격 라벨 (우측) */}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 space-y-8">
              {[45, 42, 39, 36].map((price, idx) => (
                <div key={idx} className="text-xs text-slate-400 bg-slate-900/80 px-2 py-1 rounded">
                  ${price}
                </div>
              ))}
            </div>

            {/* 시간 라벨 (하단) */}
            <div className="absolute bottom-2 left-8 right-8 flex justify-between">
              {['09:00', '12:00', '15:00', '18:00', '21:00'].map((time, idx) => (
                <div key={idx} className="text-xs text-slate-400">
                  {time}
                </div>
              ))}
            </div>
          </div>

          {/* 거래량 차트 (하단) */}
          <div className="absolute bottom-16 left-4 right-4 h-16 bg-slate-800/50 rounded">
            <div className="flex items-end h-full px-2 space-x-1">
              {Array.from({length: 50}, (_, i) => (
                <div 
                  key={i}
                  className="bg-blue-400/60 min-w-[2px] rounded-t"
                  style={{ height: `${Math.random() * 100}%` }}
                />
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* 하단 탭 영역 */}
      <div className="border-t border-slate-700 bg-slate-900">
        <Tabs defaultValue="positions" className="h-full">
          <TabsList className="grid w-full grid-cols-6 bg-transparent">
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="composition">Composition</TabsTrigger>
            <TabsTrigger value="funding">Funding</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <div className="h-32 overflow-y-auto">
            <TabsContent value="positions" className="p-4 mt-0">
              <div className="text-center text-slate-400">
                <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                <p>현재 포지션이 없습니다</p>
                <p className="text-sm">첫 번째 투자를 시작해보세요!</p>
              </div>
            </TabsContent>

            <TabsContent value="orders" className="p-4 mt-0">
              <div className="text-center text-slate-400">
                <BarChart3 className="w-8 h-8 mx-auto mb-2" />
                <p>활성 주문이 없습니다</p>
              </div>
            </TabsContent>

            <TabsContent value="history" className="p-4 mt-0">
              <div className="text-center text-slate-400">
                <p>거래 기록이 없습니다</p>
              </div>
            </TabsContent>

            <TabsContent value="composition" className="p-4 mt-0">
              <div className="space-y-2">
                <div className="text-sm font-semibold">인덱스 구성</div>
                <div className="grid grid-cols-5 gap-2 text-xs">
                  {['WIF 25%', 'BONK 20%', 'POPCAT 20%', 'PEPE 18%', 'SHIB 12%'].map((item, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="funding" className="p-4 mt-0">
              <div className="text-xs text-slate-400">
                <div className="flex justify-between mb-1">
                  <span>현재 펀딩비</span>
                  <span className="text-green-400">0.0085%</span>
                </div>
                <div className="flex justify-between">
                  <span>다음 펀딩</span>
                  <span>7h 52m</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="p-4 mt-0">
              <div className="text-xs text-slate-400">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-white font-medium">샤프 비율</div>
                    <div>2.34</div>
                  </div>
                  <div>
                    <div className="text-white font-medium">최대 낙폭</div>
                    <div className="text-red-400">-23.5%</div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

    </div>
  )
}