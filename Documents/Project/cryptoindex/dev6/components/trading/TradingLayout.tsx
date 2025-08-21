'use client'

import { useState } from 'react'
import IndexInfoBar from './IndexInfoBar'
import ChartArea from './ChartArea'
// Temporarily commented out - components not yet implemented
// import OrderBook from './OrderBook'
// import TradingPanel from './TradingPanel'
// import RecentTrades from './RecentTrades'
// import AccountPanel from './AccountPanel'
// import CommunityFeed from './CommunityFeed'

export default function TradingLayout() {
  const [selectedIndex, setSelectedIndex] = useState('MEME_INDEX')

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* 인덱스 정보 헤더 (전체 너비) */}
      <div className="w-full border-b border-slate-800">
        <IndexInfoBar 
          selectedIndex={selectedIndex} 
          onIndexChange={setSelectedIndex} 
        />
      </div>

      {/* 메인 트레이딩 그리드 */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-1 h-[calc(100vh-80px)]">
        
        {/* 좌측: 차트 + 계정 정보 (60% 너비) */}
        <div className="xl:col-span-3 flex flex-col gap-1">
          {/* 차트 영역 */}
          <div className="flex-1 bg-slate-900 rounded-sm">
            <ChartArea selectedIndex={selectedIndex} />
          </div>
          
          {/* 계정 패널 */}
          <div className="h-80 bg-slate-900 rounded-sm">
            {/* <AccountPanel /> */}
            <div className="bg-slate-900 p-4 border border-slate-800 rounded">
              <p className="text-slate-400">Account Panel - Coming Soon</p>
            </div>
          </div>
        </div>

        {/* 우측: 주문 관리 & 시장 정보 (40% 너비) */}
        <div className="xl:col-span-2 grid grid-rows-4 gap-1">
          
          {/* 오더북 */}
          <div className="bg-slate-900 rounded-sm">
            {/* <OrderBook selectedIndex={selectedIndex} /> */}
            <div className="bg-slate-900 p-4 border border-slate-800 rounded h-full">
              <p className="text-slate-400">Order Book - Coming Soon</p>
            </div>
          </div>
          
          {/* 트레이딩 패널 */}
          <div className="bg-slate-900 rounded-sm">
            {/* <TradingPanel selectedIndex={selectedIndex} /> */}
            <div className="bg-slate-900 p-4 border border-slate-800 rounded h-full">
              <p className="text-slate-400">Trading Panel - Coming Soon</p>
            </div>
          </div>
          
          {/* 최근 거래 */}
          <div className="bg-slate-900 rounded-sm">
            {/* <RecentTrades selectedIndex={selectedIndex} /> */}
            <div className="bg-slate-900 p-4 border border-slate-800 rounded h-full">
              <p className="text-slate-400">Recent Trades - Coming Soon</p>
            </div>
          </div>
          
          {/* 커뮤니티 피드 */}
          <div className="bg-slate-900 rounded-sm">
            {/* <CommunityFeed /> */}
            <div className="bg-slate-900 p-4 border border-slate-800 rounded h-full">
              <p className="text-slate-400">Community Feed - Coming Soon</p>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}