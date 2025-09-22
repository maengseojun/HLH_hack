"use client";

import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from "recharts";
import IndexDetailsModal, { type IndexDetails } from "@/components/IndexDetailsModal";
import ShareModal from "@/components/ShareModal";
import RedeemModal from "@/components/RedeemModal";
import UploadModal from "@/components/UploadModal";
import ConfirmLaunchModal from "@/components/ConfirmLaunchModal";
import type { PositionSide } from "@/lib/api";

// Dummy data for testing
type AssetTemplate = {
  symbol: string;
  name: string;
  markPx: number;
  dayNtlVlm: number;
  openInterest: number;
  maxLeverage: number;
  change24h: number;
};

const dummyAssets: AssetTemplate[] = [
  { symbol: "BTC", name: "Bitcoin", markPx: 98000, dayNtlVlm: 1_000_000, openInterest: 50000, maxLeverage: 20, change24h: 2.5 },
  { symbol: "ETH", name: "Ethereum", markPx: 3500, dayNtlVlm: 800_000, openInterest: 40000, maxLeverage: 20, change24h: 1.8 },
  { symbol: "SOL", name: "Solana", markPx: 245, dayNtlVlm: 300_000, openInterest: 15000, maxLeverage: 10, change24h: -0.5 },
  { symbol: "UNI", name: "Uniswap", markPx: 12.5, dayNtlVlm: 100_000, openInterest: 8000, maxLeverage: 10, change24h: 3.2 },
  { symbol: "AAVE", name: "Aave", markPx: 320, dayNtlVlm: 80_000, openInterest: 6000, maxLeverage: 5, change24h: 1.1 },
];

type IndexStatus = "Active" | "Redeemed";

type DummyIndex = {
  id: number;
  name: string;
  symbol: string;
  status: IndexStatus;
  currentValue: string;
  nav: string;
  change7d: string;
  composition: Array<{ asset: string; percentage: number; value: string }>;
};

type SelectedAsset = AssetTemplate & {
  side: PositionSide;
  leverage: number;
  allocationPct: number;
  hypeAmount: number;
};

const POSITION_SIDES: PositionSide[] = ["long", "short"];

const dummyIndexes: DummyIndex[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  name: `Test Index ${i + 1}`,
  symbol: `TEST${i + 1}`,
  status: (i % 3 === 0 ? "Redeemed" : "Active") as IndexStatus,
  currentValue: `$${(1000 + Math.random() * 2000).toFixed(2)}`,
  nav: `$${(1000 + Math.random() * 2000).toFixed(2)}`,
  change7d: ((Math.random() - 0.5) * 30).toFixed(1),
  composition: [
    { asset: "BTC", percentage: 30, value: `$${(300 + Math.random() * 200).toFixed(2)}` },
    { asset: "ETH", percentage: 25, value: `$${(250 + Math.random() * 150).toFixed(2)}` },
    { asset: "SOL", percentage: 20, value: `$${(200 + Math.random() * 100).toFixed(2)}` },
    { asset: "UNI", percentage: 15, value: `$${(150 + Math.random() * 75).toFixed(2)}` },
    { asset: "AAVE", percentage: 10, value: `$${(100 + Math.random() * 50).toFixed(2)}` },
  ],
}));

const dummyChartData = [
  { date: "Day 1", value: 1000 },
  { date: "2", value: 1050 },
  { date: "3", value: 980 },
  { date: "4", value: 1120 },
  { date: "5", value: 1080 },
  { date: "6", value: 1150 },
  { date: "7", value: 1220 },
];

export default function TestPage() {
  // Development only protection
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="w-full min-h-screen bg-[color:var(--color-background)] flex items-center justify-center">
        <div className="glass-card rounded-[12px] p-8 text-center">
          <h1 className="text-white text-2xl font-bold mb-4">404 - Page Not Found</h1>
          <p className="text-[color:var(--color-muted-foreground)] mb-6">
            This page is only available in development mode.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className="rounded-[12px] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] px-6 py-2 hover:opacity-90 transition-opacity"
          >
            Go to Launch
          </button>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<"launch" | "index">("launch");
  const [search, setSearch] = useState("");
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [filterActive, setFilterActive] = useState(true);
  const [filterRedeemed, setFilterRedeemed] = useState(true);
  const [sortBy, setSortBy] = useState("Date");
  
  // Launch-related states
  const [showUpload, setShowUpload] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [indexName, setIndexName] = useState("");
  const [ticker, setTicker] = useState("");
  
  // Index-related states
  const [showDetails, setShowDetails] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<IndexDetails | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);

  const addAsset = (asset: AssetTemplate) => {
    if (!selectedAssets.find(s => s.symbol === asset.symbol)) {
      const newAsset: SelectedAsset = {
        ...asset,
        side: POSITION_SIDES[0],
        leverage: 1,
        allocationPct: 25,
        hypeAmount: 100,
      };
      setSelectedAssets(prev => [...prev, newAsset]);
    }
    setSearch("");
  };

  const removeAsset = (symbol: string) => {
    setSelectedAssets(prev => prev.filter(s => s.symbol !== symbol));
  };

  const updateAsset = (symbol: string, update: Partial<SelectedAsset>) => {
    setSelectedAssets(prev => prev.map(s => (s.symbol === symbol ? { ...s, ...update } : s)));
  };

  const filteredAssets: AssetTemplate[] = search
    ? dummyAssets
        .filter(a =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          a.symbol.toLowerCase().includes(search.toLowerCase()),
        )
        .slice(0, 5)
    : [];

  const filteredIndexes = dummyIndexes.filter(idx => {
    if (!filterActive && idx.status === "Active") return false;
    if (!filterRedeemed && idx.status === "Redeemed") return false;
    return true;
  });

  return (
    <div className="w-full min-h-[70vh] flex flex-col">
      <div className="ui-scale flex-1">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-white text-3xl font-bold mb-4">Test Page - CoreIndex Components</h1>
          <p className="text-[color:var(--color-muted-foreground)]">
            Test environment with dummy data for Launch and Index components
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="glass-nav rounded-full p-1 inline-flex mb-8">
          <button
            onClick={() => setActiveTab("launch")}
            className={`px-6 py-2 rounded-full font-medium transition-all ${
              activeTab === "launch"
                ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]"
                : "text-[color:var(--color-muted-foreground)] hover:text-white"
            }`}
          >
            Launch Test
          </button>
          <button
            onClick={() => setActiveTab("index")}
            className={`px-6 py-2 rounded-full font-medium transition-all ${
              activeTab === "index"
                ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]"
                : "text-[color:var(--color-muted-foreground)] hover:text-white"
            }`}
          >
            Index Test
          </button>
        </div>

        {/* Launch Test Tab */}
        {activeTab === "launch" && (
          <div className="space-y-8">
            <h2 className="text-white text-2xl font-semibold">Launch Component Test</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Basics */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">Basics</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-[color:var(--color-muted-foreground)] mb-1">Index Name</div>
                    <div className="glass-input rounded-[12px]">
                      <input 
                        placeholder="Enter index name" 
                        value={indexName}
                        onChange={(e) => setIndexName(e.target.value)}
                        className="w-full px-3 py-2 text-white bg-transparent border-none outline-none placeholder-gray-400" 
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-[color:var(--color-muted-foreground)] mb-1">Ticker</div>
                    <div className="glass-input rounded-[12px]">
                      <input 
                        placeholder="e.g., MYIDX" 
                        value={ticker}
                        onChange={(e) => setTicker(e.target.value.toUpperCase())}
                        maxLength={8}
                        className="w-full px-3 py-2 text-white bg-transparent border-none outline-none placeholder-gray-400" 
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-[color:var(--color-muted-foreground)] mb-1">Cover Image</div>
                    <div className="flex gap-2 items-center">
                      <button 
                        onClick={() => setShowUpload(true)} 
                        className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-2 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]"
                      >
                        Upload
                      </button>
                      {imageName && <span className="text-[color:var(--color-muted-foreground)] text-sm">{imageName}</span>}
                    </div>
                    {imageUrl && (
                      <div className="mt-3 rounded-[12px] overflow-hidden border border-[color:var(--color-border)] w-full h-32">
                        <img src={imageUrl} alt="Cover" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[color:var(--color-muted-foreground)] mb-1">Description</div>
                    <div className="glass-input rounded-[12px]">
                      <textarea 
                        rows={3} 
                        placeholder="Describe your index" 
                        className="w-full px-3 py-2 text-white bg-transparent border-none outline-none placeholder-gray-400 resize-none" 
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Asset Search */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">Asset Search & Selection</h3>
                <div className="relative">
                  <div className="glass-input rounded-[12px]">
                    <input
                      placeholder="Search assets..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full px-3 py-2 text-white bg-transparent border-none outline-none placeholder-gray-400"
                    />
                  </div>
                  {search && filteredAssets.length > 0 && (
                    <div className="absolute z-10 mt-2 w-full glass-dropdown rounded-[12px] p-2">
                      {filteredAssets.map((asset) => (
                        <button
                          key={asset.symbol}
                          onClick={() => addAsset(asset)}
                          className="w-full text-left px-3 py-2 rounded-[8px] text-white hover:bg-white/20"
                        >
                          <div className="font-medium">{asset.symbol}</div>
                          <div className="text-[color:var(--color-muted-foreground)] text-xs">{asset.name}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Assets */}
                <div className="space-y-3">
                  {selectedAssets.map((asset) => (
                    <div key={asset.symbol} className="glass-card rounded-[12px] p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-white font-medium">{asset.symbol}</div>
                          <div className="text-[color:var(--color-muted-foreground)] text-sm">{asset.name}</div>
                        </div>
                        <button
                          onClick={() => removeAsset(asset.symbol)}
                          className="text-red-400 border border-red-400 rounded-lg px-2 py-1 text-sm hover:bg-red-400 hover:text-white"
                        >
                          Remove
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[color:var(--color-muted-foreground)] text-sm">Side</label>
                          <div className="flex gap-1 mt-1">
                            {POSITION_SIDES.map((side) => (
                              <button
                                key={side}
                                onClick={() => updateAsset(asset.symbol, { side })}
                                className={`px-3 py-1 rounded-lg text-xs ${
                                  asset.side === side
                                    ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]"
                                    : "bg-white/10 text-white hover:bg-white/20"
                                }`}
                              >
                                {side}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-[color:var(--color-muted-foreground)] text-sm">Allocation (%)</label>
                          <div className="glass-input rounded-[8px] mt-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={asset.allocationPct || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                  updateAsset(asset.symbol, { allocationPct: 25 });
                                } else {
                                  const num = parseFloat(val);
                                  if (!isNaN(num)) {
                                    updateAsset(asset.symbol, { allocationPct: Math.max(0, Math.min(100, Math.round(num))) });
                                  }
                                }
                              }}
                              className="w-full px-2 py-1 text-white bg-transparent border-none outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Chart */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">Portfolio Preview</h3>
                <div className="glass-card rounded-[12px] p-4">
                  <div className="h-64 pr-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dummyChartData}>
                        <XAxis 
                          dataKey="date" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: "#A0B5B2", fontSize: 11 }} 
                          interval={0}
                        />
                        <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: "#A0B5B2", fontSize: 11 }} 
                          width={40}
                        />
                        <Area type="monotone" dataKey="value" stroke="#98FCE4" fill="#98FCE4" fillOpacity={0.2} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div className="glass-card rounded-[12px] p-4 text-sm text-[color:var(--color-muted-foreground)]">
                  Test preview with dummy data. Total assets: {selectedAssets.length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Index Test Tab */}
        {activeTab === "index" && (
          <div className="space-y-6">
            <h2 className="text-white text-2xl font-semibold">Index Hub Test</h2>
            
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="glass-input rounded-[12px] flex-1 max-w-md">
                <input
                  placeholder="Search indexes..."
                  className="w-full px-3 py-2 text-white bg-transparent border-none outline-none placeholder-gray-400"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <div className="glass-input rounded-[12px] flex items-center gap-4 px-3 py-2">
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="checkbox"
                      checked={filterActive}
                      onChange={(e) => setFilterActive(e.target.checked)}
                      className="size-4 accent-[color:var(--color-primary)]"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                  <label className="flex items-center gap-2 text-white">
                    <input
                      type="checkbox"
                      checked={filterRedeemed}
                      onChange={(e) => setFilterRedeemed(e.target.checked)}
                      className="size-4 accent-[color:var(--color-primary)]"
                    />
                    <span className="text-sm">Redeemed</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Index Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredIndexes.map((index) => (
                <div key={index.id} className="glass-card rounded-[12px] p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-white font-medium">{index.name}</div>
                      <div className="text-[color:var(--color-muted-foreground)]">{index.symbol}</div>
                    </div>
                    <span className={`rounded-[8px] px-2 py-0.5 text-xs ${
                      index.status === "Active"
                        ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]"
                        : "bg-gray-600 text-gray-200"
                    }`}>
                      {index.status}
                    </span>
                  </div>
                  
                  <div className="text-white font-medium mb-2">{index.currentValue}</div>
                  <div className={`mb-4 ${
                    parseFloat(index.change7d) >= 0 ? "text-green-400" : "text-red-400"
                  }`}>
                    {parseFloat(index.change7d) >= 0 ? "+" : ""}{index.change7d}% (7d)
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setSelectedIndex({
                          name: index.name,
                          symbol: index.symbol,
                          status: index.status,
                          currentValue: index.currentValue,
                          nav: index.nav,
                          composition: index.composition,
                        });
                        setShowDetails(true);
                      }}
                      className="flex-1 rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-2 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)] text-sm"
                    >
                      Details
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedIndex({
                          name: index.name,
                          symbol: index.symbol,
                          status: index.status,
                          currentValue: index.currentValue,
                          nav: index.nav,
                        });
                        setShowRedeem(true);
                      }}
                      className="flex-1 rounded-[12px] border border-red-400 px-3 py-2 text-red-400 hover:bg-red-400 hover:text-white text-sm"
                    >
                      Redeem
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedIndex({ name: index.name, symbol: index.symbol });
                        setShowShare(true);
                      }}
                      className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-2 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)] text-sm"
                    >
                      Share
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Footer - only show on Launch tab */}
      {activeTab === "launch" && (
        <div className="fixed bottom-0 left-0 right-0 glass-card border-t border-[color:var(--color-border)]">
          <div className="mx-auto max-w-[1440px] px-6 py-3 flex items-center justify-between" style={{ fontSize: 12, lineHeight: 1.4 }}>
            <div className="flex gap-8 text-white">
              <div>
                <div className="text-[color:var(--color-muted-foreground)]">Total Cost</div>
                <div>${selectedAssets.reduce((sum, s) => sum + (s.hypeAmount || 0), 0).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[color:var(--color-muted-foreground)]">Fee</div>
                <div>${(selectedAssets.reduce((sum, s) => sum + (s.hypeAmount || 0), 0) * 0.005).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-[color:var(--color-muted-foreground)]">HYPE Balance</div>
                <div>$0.00</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-1.5 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]" style={{ fontSize: 12 }}>Inline Swap</button>
              <button 
                onClick={() => setShowLaunchModal(true)}
                disabled={selectedAssets.length === 0}
                className="inline-flex items-center justify-center rounded-[12px] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] disabled:bg-[color:var(--color-primary)]/50 disabled:cursor-not-allowed" 
                style={{ fontSize: 12, minWidth: 80, paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12 }}
              >
                Launch
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modals */}
      <UploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onConfirm={(file) => {
          const url = URL.createObjectURL(file);
          setImageUrl(url);
          setImageName(file.name);
          setShowUpload(false);
        }}
      />
      
      <ConfirmLaunchModal
        open={showLaunchModal}
        onClose={() => setShowLaunchModal(false)}
        onConfirm={() => {
          console.log("Launching test index:", { indexName, ticker, selectedAssets });
          setShowLaunchModal(false);
        }}
        indexName={indexName}
        ticker={ticker}
        selectedAssets={selectedAssets.map(s => ({
          symbol: s.symbol,
          name: s.name,
          side: s.side,
          hypeAmount: s.hypeAmount,
          usdcAmount: s.hypeAmount,
          allocationPct: s.allocationPct,
          leverage: s.leverage
        }))}
        totalCost={selectedAssets.reduce((sum, s) => sum + (s.hypeAmount || 0), 0)}
        feeAmount={selectedAssets.reduce((sum, s) => sum + (s.hypeAmount || 0), 0) * 0.005}
      />
      
      <IndexDetailsModal 
        open={showDetails} 
        onClose={() => setShowDetails(false)} 
        index={selectedIndex} 
      />
      
      <RedeemModal 
        open={showRedeem} 
        onClose={() => setShowRedeem(false)} 
        index={selectedIndex} 
      />
      
      <ShareModal
        open={showShare}
        onClose={() => setShowShare(false)}
        name={selectedIndex?.name ?? ""}
        symbol={selectedIndex?.symbol ?? ""}
      />
    </div>
  );
}
