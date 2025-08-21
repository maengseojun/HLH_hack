'use client'

import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Users, BarChart3, PieChart } from 'lucide-react'

interface IndexInfoModalProps {
  isOpen: boolean
  onClose: () => void
  indexData: {
    id: string
    name: string
    symbol: string
    price: number
    change24h: number
    volume24h: number
    components: string[]
  }
}

// Mock 데이터
const MOCK_INDEX_DETAILS = {
  totalSupply: '1,000,000',
  marketCap: '$42,850,000',
  nav: '$42.85',
  premium: '+0.05%',
  lastRebalance: '2025-07-20',
  votingPower: '12,450',
  aum: '$128.5M',
  managementFee: '0.75%',
  performanceFee: '15%'
}

const MOCK_COMPONENTS = [
  { symbol: 'WIF', name: 'dogwifhat', weight: 25, price: '$2.45', change: '+5.2%', allocation: '$10.7M' },
  { symbol: 'BONK', name: 'Bonk', weight: 20, price: '$0.000034', change: '+12.1%', allocation: '$8.6M' },
  { symbol: 'POPCAT', name: 'Popcat', weight: 20, price: '$0.85', change: '+18.5%', allocation: '$8.6M' },
  { symbol: 'PEPE', name: 'Pepe', weight: 18, price: '$0.0000087', change: '-2.3%', allocation: '$7.7M' },
  { symbol: 'SHIB', name: 'Shiba Inu', weight: 12, price: '$0.000015', change: '+3.8%', allocation: '$5.1M' },
  { symbol: 'FLOKI', name: 'FLOKI', weight: 5, price: '$0.000125', change: '+8.9%', allocation: '$2.1M' },
]

const MOCK_PERFORMANCE = [
  { period: '1D', return: '+12.34%', benchmark: '+8.21%' },
  { period: '7D', return: '+28.5%', benchmark: '+18.4%' },
  { period: '30D', return: '+145.2%', benchmark: '+89.3%' },
  { period: '1Y', return: '+892.1%', benchmark: '+234.5%' },
]

export default function IndexInfoModal({ isOpen, onClose, indexData }: IndexInfoModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-slate-900 text-white border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            {indexData.symbol} - {indexData.name}
            <Badge variant="outline" className="text-green-400 border-green-400">
              ACTIVE
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            밈코인 시장을 대표하는 인덱스의 상세 정보
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
          
          {/* 기본 정보 */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <BarChart3 className="w-5 h-5" />
                기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">현재가</span>
                <span className="font-semibold">${indexData.price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">NAV</span>
                <span className="font-semibold">{MOCK_INDEX_DETAILS.nav}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">프리미엄</span>
                <span className="text-green-400">{MOCK_INDEX_DETAILS.premium}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">총 발행량</span>
                <span className="font-semibold">{MOCK_INDEX_DETAILS.totalSupply}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">시가총액</span>
                <span className="font-semibold">{MOCK_INDEX_DETAILS.marketCap}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">AUM</span>
                <span className="font-semibold">{MOCK_INDEX_DETAILS.aum}</span>
              </div>
            </CardContent>
          </Card>

          {/* 수수료 & 거버넌스 */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="w-5 h-5" />
                거버넌스 & 수수료
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-400">관리 수수료</span>
                <span className="font-semibold">{MOCK_INDEX_DETAILS.managementFee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">성과 수수료</span>
                <span className="font-semibold">{MOCK_INDEX_DETAILS.performanceFee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">투표권 보유</span>
                <span className="font-semibold">{MOCK_INDEX_DETAILS.votingPower}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">마지막 리밸런싱</span>
                <span className="font-semibold">{MOCK_INDEX_DETAILS.lastRebalance}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">다음 투표</span>
                <span className="text-yellow-400">2일 남음</span>
              </div>
            </CardContent>
          </Card>

          {/* 성과 분석 */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <TrendingUp className="w-5 h-5" />
                성과 분석
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {MOCK_PERFORMANCE.map((perf, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-slate-400">{perf.period}</span>
                  <div className="text-right">
                    <div className="text-green-400 font-semibold">{perf.return}</div>
                    <div className="text-xs text-slate-500">vs {perf.benchmark}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* 구성 자산 */}
        <Card className="bg-slate-800 border-slate-700 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <PieChart className="w-5 h-5" />
              구성 자산 ({MOCK_COMPONENTS.length}개)
            </CardTitle>
            <CardDescription>
              인덱스를 구성하는 밈코인 자산들의 현재 상태
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOCK_COMPONENTS.map((component, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold">
                      {component.symbol.slice(0, 2)}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{component.symbol}</div>
                      <div className="text-xs text-slate-400">{component.name}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium">{component.weight}%</div>
                      <Progress value={component.weight} className="w-16 h-1" />
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{component.price}</div>
                      <div className={`text-xs ${component.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                        {component.change}
                      </div>
                    </div>
                    <div className="text-right min-w-20">
                      <div className="text-sm font-semibold">{component.allocation}</div>
                      <div className="text-xs text-slate-400">할당량</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </DialogContent>
    </Dialog>
  )
}