'use client'

import { useState } from 'react'
import { ChevronDown, Info, Star, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import IndexInfoModal from './IndexInfoModal'

interface IndexInfoBarProps {
  selectedIndex: string
  onIndexChange: (index: string) => void
}

const MOCK_INDICES = [
  { 
    id: 'MEME_INDEX', 
    name: 'Top Meme Index', 
    symbol: 'MEME',
    price: 42.85,
    change24h: 12.34,
    volume24h: 2847392,
    components: ['WIF', 'BONK', 'POPCAT', 'PEPE', 'SHIB']
  },
  { 
    id: 'DOG_INDEX', 
    name: 'Doggy Index', 
    symbol: 'DOG',
    price: 18.92,
    change24h: -3.45,
    volume24h: 1234567,
    components: ['DOGE', 'SHIB', 'FLOKI', 'BABYDOGE']
  },
  { 
    id: 'AI_INDEX', 
    name: 'AI Meme Index', 
    symbol: 'AI',
    price: 67.21,
    change24h: 8.76,
    volume24h: 3456789,
    components: ['GOAT', 'ACT', 'AIXBT', 'VIRTUAL']
  },
]

export default function IndexInfoBar({ selectedIndex, onIndexChange }: IndexInfoBarProps) {
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [favorites, setFavorites] = useState<string[]>(['MEME_INDEX'])
  
  const currentIndex = MOCK_INDICES.find(idx => idx.id === selectedIndex) || MOCK_INDICES[0]
  const isPositive = currentIndex.change24h > 0

  const toggleFavorite = (indexId: string) => {
    setFavorites(prev => 
      prev.includes(indexId) 
        ? prev.filter(id => id !== indexId)
        : [...prev, indexId]
    )
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        
        {/* 인덱스 선택 드롭다운 */}
        <div className="flex items-center space-x-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="text-white hover:bg-slate-800 p-2">
                <span className="text-lg font-semibold">{currentIndex.symbol}</span>
                <span className="text-sm text-slate-400 ml-2">{currentIndex.name}</span>
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-slate-900 border-slate-700">
              {MOCK_INDICES.map((index) => (
                <DropdownMenuItem
                  key={index.id}
                  onClick={() => onIndexChange(index.id)}
                  className="flex items-center justify-between p-3 hover:bg-slate-800"
                >
                  <div className="flex items-center space-x-2">
                    <Star 
                      className={`w-4 h-4 cursor-pointer ${favorites.includes(index.id) ? 'text-yellow-400 fill-current' : 'text-slate-500'}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(index.id)
                      }}
                    />
                    <div>
                      <div className="font-medium text-white">{index.symbol}</div>
                      <div className="text-xs text-slate-400">{index.name}</div>
                    </div>
                  </div>
                  <div className={`text-sm ${index.change24h > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {index.change24h > 0 ? '+' : ''}{index.change24h.toFixed(2)}%
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => toggleFavorite(selectedIndex)}
            className="text-slate-400 hover:text-yellow-400"
          >
            <Star className={`w-4 h-4 ${favorites.includes(selectedIndex) ? 'text-yellow-400 fill-current' : ''}`} />
          </Button>
        </div>

        {/* 가격 정보 */}
        <div className="flex items-center space-x-8">
          
          {/* 현재가 */}
          <div className="text-center">
            <div className="text-2xl font-bold">${currentIndex.price.toFixed(2)}</div>
            <div className="text-xs text-slate-400">현재가</div>
          </div>

          {/* 24h 변동률 */}
          <div className="text-center">
            <div className={`flex items-center text-lg font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {isPositive ? '+' : ''}{currentIndex.change24h.toFixed(2)}%
            </div>
            <div className="text-xs text-slate-400">24h 변동</div>
          </div>

          {/* 24h 고가/저가 */}
          <div className="text-center">
            <div className="text-sm">
              <span className="text-green-400">${(currentIndex.price * 1.05).toFixed(2)}</span>
              <span className="text-slate-400 mx-1">/</span>
              <span className="text-red-400">${(currentIndex.price * 0.95).toFixed(2)}</span>
            </div>
            <div className="text-xs text-slate-400">24h 고가/저가</div>
          </div>

          {/* 24h 거래량 */}
          <div className="text-center">
            <div className="text-sm font-medium">${currentIndex.volume24h.toLocaleString()}</div>
            <div className="text-xs text-slate-400">24h 거래량</div>
          </div>

          {/* 펀딩비 (Mock) */}
          <div className="text-center">
            <div className="text-sm text-green-400">0.0085%</div>
            <div className="text-xs text-slate-400">펀딩비 (7h 52m)</div>
          </div>

          {/* 미결제약정 (Mock) */}
          <div className="text-center">
            <div className="text-sm">$1,234,567</div>
            <div className="text-xs text-slate-400">미결제약정</div>
          </div>
        </div>

        {/* 정보 버튼 */}
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-green-400 border-green-400">
            ACTIVE
          </Badge>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowInfoModal(true)}
            className="text-slate-400 hover:text-white"
          >
            <Info className="w-4 h-4" />
          </Button>
        </div>

      </div>

      <IndexInfoModal 
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        indexData={currentIndex}
      />
    </>
  )
}