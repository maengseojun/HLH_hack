"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import UploadModal from "@/components/UploadModal";
import ConfirmLaunchModal from "@/components/ConfirmLaunchModal";
import LaunchSuccessModal from "@/components/LaunchSuccessModal";
import { getAssets, getCandles, postBasketCalculate, type Asset, type BasketItemInput, type PositionSide, type Candle } from "@/lib/api";

// NO MORE MOCK DATA - only real API data

const clamp01_50 = (v: number) => Math.max(1, Math.min(50, Math.round(v)));
const clamp0_100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

// Custom tooltip component for Preview chart
const PreviewCustomTooltip = ({ active, payload, label, timeframe }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const change = value > 100 ? `+${(value - 100).toFixed(2)}%` : `${(value - 100).toFixed(2)}%`;
    const changeColor = value > 100 ? "#10b981" : "#ef4444"; // green or red
    
    // Format date based on timeframe
    const formatDate = (dateLabel: string, tf: string = "1D") => {
      if (tf === "1H") {
        // For 1H timeframe, dateLabel is time like "15:30"
        if (dateLabel.includes(':')) {
          return dateLabel; // Already in HH:MM format
        }
      } else {
        // For 1D timeframe, dateLabel is MM/DD format, tooltip should show MM/DD/YYYY
        if (dateLabel.includes('/')) {
          const now = new Date();
          const year = now.getFullYear();
          return `${dateLabel}/${year}`;
        }
      }
      
      // Handle ISO dates from API
      if (dateLabel.includes('-')) {
        const date = new Date(dateLabel);
        if (!isNaN(date.getTime())) {
          if (tf === "1H") {
            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          } else {
            // 1D
            return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
          }
        }
      }
      
      return dateLabel; // Return original if can't format
    };
    
    return (
      <div className="bg-[color:var(--color-card)]/95 backdrop-blur-sm border border-[color:var(--color-border)] rounded-lg p-3 shadow-lg">
        <div className="text-white text-sm font-medium mb-1">
          {formatDate(label, timeframe)}
        </div>
        <div className="text-white text-lg font-semibold">
          {value.toFixed(2)}
        </div>
        <div className="text-xs" style={{ color: changeColor }}>
          {change} from start
        </div>
      </div>
    );
  }
  return null;
};

type BasketCalculationPoint = {
  date?: string;
  value?: number;
  nav?: number;
};

type BasketCalculationResponse = {
  data?: BasketCalculationPoint[];
};

type SelectedAsset = {
  symbol: string;
  name: string;
  side: PositionSide;
  leverage: number;
  marketType: 'perp' | 'spot';
};

type PortfolioComposition = {
  totalAmount: number;
  allocations: { [symbol: string]: number }; // percentage 0-100
};

const POSITION_SIDES: PositionSide[] = ["long", "short"];

function isBasketCalculationResponse(value: unknown): value is BasketCalculationResponse {
  if (!value || typeof value !== "object") return false;
  const maybe = value as { data?: unknown };
  if (!Array.isArray(maybe.data)) return false;
  return maybe.data.every((item) => {
    if (!item || typeof item !== "object") return false;
    const point = item as BasketCalculationPoint;
    const dateOk = point.date === undefined || typeof point.date === "string";
    const valueOk = point.value === undefined || typeof point.value === "number";
    const navOk = point.nav === undefined || typeof point.nav === "number";
    return dateOk && valueOk && navOk;
  });
}

export default function LaunchPage() {
  const [period, setPeriod] = useState<"1H" | "1D">("1D");
  // No fallback data - only real API data
  const [showUpload, setShowUpload] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  
  // Launch modal
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [indexName, setIndexName] = useState("");
  const [ticker, setTicker] = useState("");

  // Search assets
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    let cancel = false;
    getAssets()
      .then((list) => {
        if (!cancel) {
          setAssets(list || []);
          setAssetsError(null);
          if (!list || (Array.isArray(list) && list.length === 0)) {
            console.warn("[Launch] getAssets returned empty list. Check backend /v1/assets and env NEXT_PUBLIC_API_BASE.");
          }
        }
      })
      .catch((err: any) => {
        if (!cancel) {
          const msg = err?.message || String(err);
          setAssetsError(msg);
          console.error("[Launch] getAssets failed:", err);
        }
      });
    return () => { cancel = true; };
  }, []);
  const filtered = useMemo(() => {
    if (!search) return [] as Asset[];
    const q = search.toLowerCase();
    return assets.filter((a) => a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q)).slice(0, 10);
  }, [assets, search]);

  // Selected basket
  const [selected, setSelected] = useState<SelectedAsset[]>([]);
  const [composition, setComposition] = useState<PortfolioComposition>({
    totalAmount: 1000,
    allocations: {}
  });

  const addAsset = (a: Asset) => {
    setSelected((prev) => {
      if (prev.find((s) => s.symbol === a.symbol)) return prev;
      const next: SelectedAsset = {
        symbol: a.symbol,
        name: a.name,
        side: a.marketType === "spot" ? "long" : POSITION_SIDES[0],
        leverage: 1,
        marketType: a.marketType,
      };
      const newSelected = [...prev, next];
      
      // Auto-distribute allocations equally
      const evenSplit = 100 / newSelected.length;
      const newAllocations: { [symbol: string]: number } = {};
      newSelected.forEach(s => {
        newAllocations[s.symbol] = evenSplit;
      });
      setComposition(prevComp => ({
        ...prevComp,
        allocations: newAllocations
      }));
      
      return newSelected;
    });
    setSearch("");
  };

  const updateAsset = (symbol: string, patch: Partial<SelectedAsset>) => {
    setSelected((prev) => prev.map((s) => {
      if (s.symbol !== symbol) return s;
      if (s.marketType === "spot") {
        const filteredPatch: Partial<SelectedAsset> = { ...patch };
        if (filteredPatch.leverage !== undefined) {
          filteredPatch.leverage = 1;
        }
        if (filteredPatch.side && filteredPatch.side !== "long") {
          filteredPatch.side = "long";
        }
        return { ...s, ...filteredPatch };
      }
      return { ...s, ...patch };
    }));
  };
  
  const removeAsset = (symbol: string) => {
    setSelected((prev) => prev.filter((s) => s.symbol !== symbol));
    setComposition(prevComp => {
      const newAllocations = { ...prevComp.allocations };
      delete newAllocations[symbol];
      
      // Redistribute remaining allocations equally
      const remainingSymbols = Object.keys(newAllocations);
      if (remainingSymbols.length > 0) {
        const evenSplit = 100 / remainingSymbols.length;
        remainingSymbols.forEach(sym => {
          newAllocations[sym] = evenSplit;
        });
      }
      
      return {
        ...prevComp,
        allocations: newAllocations
      };
    });
  };

  const updateAllocation = (symbol: string, percentage: number) => {
    setComposition(prev => ({
      ...prev,
      allocations: {
        ...prev.allocations,
        [symbol]: Math.max(0, Math.min(100, percentage))
      }
    }));
  };

  const setTotalAmount = (amount: number) => {
    setComposition(prev => ({
      ...prev,
      totalAmount: Math.max(0, amount)
    }));
  };

  // Helper functions for new composition structure
  const getAssetAmount = (symbol: string) => {
    const percentage = composition.allocations[symbol] || 0;
    return (percentage / 100) * composition.totalAmount;
  };

  // Allocation validation
  const totalAllocation = useMemo(() => {
    return Object.values(composition.allocations).reduce((sum, pct) => sum + pct, 0);
  }, [composition.allocations]);
  
  const allocationWarning = useMemo(() => {
    if (selected.length === 0) return null;
    const diff = Math.abs(totalAllocation - 100);
    if (diff > 0.1) return `Total allocation: ${totalAllocation.toFixed(1)}% (should be 100%)`;
    return null;
  }, [totalAllocation, selected.length]);

  // Auto-balance allocations to 100%
  const autoBalanceAllocations = () => {
    if (selected.length === 0) return;
    const evenSplit = 100 / selected.length;
    const newAllocations: { [symbol: string]: number } = {};
    
    // Give equal parts to all but the last one
    selected.forEach((s, i) => {
      if (i === selected.length - 1) {
        // Last asset gets the remainder to make sure total = 100%
        const assigned = Object.values(newAllocations).reduce((sum, val) => sum + val, 0);
        newAllocations[s.symbol] = 100 - assigned;
      } else {
        newAllocations[s.symbol] = Math.floor(evenSplit * 10) / 10;
      }
    });
    
    setComposition(prev => ({
      ...prev,
      allocations: newAllocations
    }));
  };

  const totalCost = composition.totalAmount;
  const feeAmt = useMemo(() => 0.1, []); // Fixed 0.1 HYPE fee

  // Preview: fetch candles for selected assets and synthesize a combined series
  const [previewData, setPreviewData] = useState<{ date: string; value: number }[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    async function buildPreview() {
      console.log("🔄 buildPreview called", { selectedLength: selected.length, totalAllocation });
      if (selected.length === 0) { setPreviewData(null); return; }
      setPreviewLoading(true);
      try {
        // First, try using the new API endpoint
        const totalWeight = totalAllocation;
        console.log("📊 totalWeight:", totalWeight, "allocations:", composition.allocations);
        if (totalWeight > 0) { // If there are any allocations
          try {
            const basketItems: BasketItemInput[] = selected.map(s => ({
              symbol: s.symbol,
              weight: (composition.allocations[s.symbol] || 0) / 100,
              position: s.marketType === "spot" ? "long" : s.side,
              leverage: s.marketType === "spot" ? 1 : s.leverage
            }));
            
            console.log("🚀 API call with basketItems:", basketItems);
            const interval = period === "1D" ? "1d" : "1h";
            const apiResult = await postBasketCalculate({ interval, assets: basketItems });
            console.log("📥 API result:", apiResult);
            
            // Transform API result to chart data format
            if (isBasketCalculationResponse(apiResult) && apiResult.data) {
              const chartData = apiResult.data.map((item, i) => ({
                date: item.date ?? `Day ${i + 1}`,
                value: item.value ?? item.nav ?? 100,
              }));
              if (!cancel) setPreviewData(chartData);
              return;
            }
          } catch (apiError) {
            console.warn("API calculation failed, falling back to client-side:", apiError);
          }
        }
        
        // Fallback to client-side calculation
        console.log("🔄 Starting fallback client-side calculation");
        const tf = period === "1D" ? "1d" : "1h";
        const top = selected.slice(0, 5); // cap to reduce requests
        console.log("📋 Processing assets:", top.map(s => s.symbol));
        // Sequential processing to avoid rate limiting
        const series = [];
        for (let i = 0; i < top.length; i++) {
          const s = top[i];
          try {
            // Add delay between requests to avoid rate limiting
            if (i > 0) {
              console.log(`⏳ Waiting 300ms before next request to avoid rate limiting...`);
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            console.log(`📊 Getting candles for ${s.symbol}, tf: ${tf}`);
            const res = await getCandles(s.symbol, tf);
            console.log(`📈 Candles response for ${s.symbol}:`, res);
            const candles: Candle[] = res.candles ?? res.data ?? [];
            console.log(`🕯️ Processed ${candles.length} candles for ${s.symbol}`);
            
            // Calculate NAV-based values instead of normalized
            const closes = candles.map((candle) => {
              if (typeof candle.c === "number") return candle.c;
              if (typeof (candle as { close?: number }).close === "number") {
                return (candle as { close?: number }).close ?? 0;
              }
              return typeof candle.v === "number" ? candle.v : 0;
            });
            if (closes.length === 0) {
              console.warn(`❌ No valid closes for ${s.symbol}`);
              series.push(null);
              continue;
            }
            const base = closes[0] || 1;
            const isSpot = s.marketType === "spot";
            const sign = isSpot ? 1 : (s.side === "short" ? -1 : 1);
            const lev = isSpot ? 1 : Math.max(1, s.leverage || 1);
            const weight = (composition.allocations[s.symbol] || 0) / 100;
            const amount = getAssetAmount(s.symbol);
            
            console.log(`💰 ${s.symbol} calculation params:`, { weight, amount, base, sign, lev });
            
            // Calculate NAV contribution: weight * amount * leverage * price_change
            const navValues = closes.map((price) => {
              const priceReturn = sign * ((price - base) / (base || 1));
              const leveragedReturn = priceReturn * lev;
              return weight * amount * (1 + leveragedReturn);
            });
            
            const dates = candles.map((c, i) => {
              if (c.t) {
                const time = new Date(c.t);
                if (tf === "1h") {
                  return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
                } else {
                  // 1d
                  const month = (time.getMonth() + 1).toString().padStart(2, '0');
                  const date = time.getDate().toString().padStart(2, '0');
                  return `${month}/${date}`;
                }
              }
              return `${i + 1}`;
            });
            series.push({ dates, navValues, weight, amount });
          } catch (error) {
            console.error(`❌ getCandles failed for ${s.symbol}:`, error);
            
            // Handle specific error types
            if (error instanceof Error) {
              if (error.message.includes('429') || error.message.includes('rate')) {
                console.log(`🚦 Rate limited for ${s.symbol}, skipping asset`);
              } else if (error.message.includes('No candles returned') || error.message.includes('EMPTY_CANDLES')) {
                console.log(`📭 No candles available for ${s.symbol} (asset may not be supported on HyperLiquid), skipping asset`);
              } else {
                console.log(`⚠️ API error for ${s.symbol}: ${error.message}, skipping asset`);
              }
            }
            series.push(null);
          }
        }
        console.log("🔍 Series results:", series.map((s, i) => s ? `${top[i].symbol}: OK` : `${top[i].symbol}: FAILED`));
        const valid = series.filter(Boolean) as { dates: string[]; navValues: number[]; weight: number; amount: number }[];
        console.log(`✅ Valid series: ${valid.length}/${series.length}`);
        
        if (valid.length === 0) { 
          console.warn("❌ No valid series data available - all assets failed to load candles from HyperLiquid");
          console.log("📋 Failed assets:", top.map(s => s.symbol).join(', '));
          console.log("💡 This may be because these assets are not traded on HyperLiquid or have been delisted");
          if (!cancel) setPreviewData(null); 
          return; 
        }
        
        // Align by shortest length
        const len = Math.min(...valid.map((v) => v.navValues.length));
        const dates = valid[0].dates.slice(0, len);
        console.log(`📅 Using ${len} data points`);
        
        // Sum all NAV contributions to get total portfolio value
        const combined = Array.from({ length: len }).map((_, i) => {
          const totalNAV = valid.reduce((acc, s) => acc + s.navValues[i], 0);
          return { date: dates[i], value: totalNAV };
        });
        
        console.log("📊 Final combined data sample:", combined.slice(0, 3));
        if (!cancel) setPreviewData(combined);
      } finally {
        if (!cancel) setPreviewLoading(false);
      }
    }
    buildPreview();
    return () => { cancel = true; };
  }, [selected, period, composition.allocations]);

  return (
    <div className="w-full min-h-[70vh]">
      <div className="ui-scale">
        <section className="px-2 pb-6 border-b border-[color:var(--color-border)]">
          <h3 className="text-white font-bold text-2xl mb-2">Launch</h3>
          <p className="text-[color:var(--color-muted-foreground)]">Create, preview, and launch instantly</p>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8">
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
                  <button onClick={() => setShowUpload(true)} className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-2 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]">Upload</button>
                  {imageName && <span className="text-[color:var(--color-muted-foreground)] text-sm">{imageName}</span>}
                </div>
                {imageUrl && (
                  <div className="mt-3 rounded-[12px] overflow-hidden border border-[color:var(--color-border)] w-full h-40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
              <div>
                <div className="text-[color:var(--color-muted-foreground)] mb-1">Social Link (Optional)</div>
                <div className="glass-input rounded-[12px]">
                  <input 
                    placeholder="https://" 
                    type="url"
                    className="w-full px-3 py-2 text-white bg-transparent border-none outline-none placeholder-gray-400" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Components */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium">Components</h3>
              {allocationWarning && (
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 text-xs">{allocationWarning}</span>
                  <button
                    onClick={autoBalanceAllocations}
                    className="text-xs px-2 py-1 rounded-md bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 hover:bg-yellow-400/30"
                  >
                    Auto-fix
                  </button>
                </div>
              )}
            </div>
            {/* Search */}
            <div className="relative">
              <div className="glass-input rounded-[12px]">
                <input
                  placeholder="Search assets..."
                  value={search}
                  onChange={(e)=>setSearch(e.target.value)}
                  className="w-full px-3 py-2 text-white bg-transparent border-none outline-none placeholder-gray-400"
                />
              </div>
              {assetsError && (
                <div className="mt-2 text-xs text-red-400">
                  Failed to load assets: {assetsError}
                </div>
              )}
              {search && filtered.length>0 && (
                <div className="absolute z-[100] mt-2 w-full glass-dropdown rounded-[12px] p-2 max-h-64 overflow-y-auto">
                  {filtered.map((a)=> (
                    <button key={a.symbol} onClick={()=>addAsset(a)} className="w-full text-left px-3 py-2 rounded-[8px] text-white hover:bg-white/20">
                      <div className="font-medium flex items-center gap-2">
                        {a.symbol}
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-white/10 text-[color:var(--color-muted-foreground)]">
                          {a.marketType}
                        </span>
                      </div>
                      <div className="text-[color:var(--color-muted-foreground)] text-xs">{a.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Selected assets */}
            <div className="space-y-3">
              {selected.map((s)=> (
                <div key={s.symbol} className="glass-card rounded-[12px] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-white font-medium flex items-center gap-2">
                      <span>{s.symbol}</span>
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-white/10 text-[color:var(--color-muted-foreground)]">{s.marketType}</span>
                      <span className="text-[color:var(--color-muted-foreground)] text-xs">{s.name}</span>
                    </div>
                    <button onClick={()=>removeAsset(s.symbol)} className="text-red-400 border border-red-400 rounded-[10px] px-2 py-1 hover:bg-red-400 hover:text-white">Remove</button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[color:var(--color-muted-foreground)] mb-1">Side</div>
                      {s.marketType === "spot" ? (
                        <div className="text-xs text-white px-2 py-1 rounded-lg bg-white/10 inline-flex items-center gap-2">
                          Long
                          <span className="text-[color:var(--color-muted-foreground)]">(spot only)</span>
                        </div>
                      ) : (
                        <div className="inline-flex rounded-xl p-1 bg-[color:var(--color-card)] border border-[color:var(--color-border)]">
                          {POSITION_SIDES.map((v) => (
                            <button key={v} onClick={()=>updateAsset(s.symbol,{ side: v })} className={`px-2.5 py-1 rounded-lg text-xs ${s.side===v?"bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]":"text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)]"}`}>{v}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-[color:var(--color-muted-foreground)] mb-1">Leverage</div>
                      {s.marketType === "spot" ? (
                        <div className="text-xs text-white px-2 py-1 rounded-lg bg-white/10 inline-flex items-center gap-2">
                          1x
                          <span className="text-[color:var(--color-muted-foreground)]">(spot)</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="glass-input rounded-[8px] w-16 relative flex">
                            <input 
                              type="number" 
                              min={1} 
                              max={50} 
                              value={s.leverage} 
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || val === '0') {
                                  updateAsset(s.symbol, { leverage: 1 });
                                } else {
                                  updateAsset(s.symbol, { leverage: clamp01_50(parseInt(val) || 1) });
                                }
                              }}
                              className="no-spinner flex-1 px-2 py-2 text-white bg-transparent border-none outline-none text-center" 
                            />
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => updateAsset(s.symbol, { leverage: clamp01_50(s.leverage + 1) })}
                                className="px-1 py-0.5 text-[#A0B5B2] hover:text-[#98FCE4] text-xs leading-none"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                onClick={() => updateAsset(s.symbol, { leverage: clamp01_50(s.leverage - 1) })}
                                className="px-1 py-0.5 text-[#A0B5B2] hover:text-[#98FCE4] text-xs leading-none"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                          <input type="range" min={1} max={50} value={s.leverage} onChange={(e)=>updateAsset(s.symbol,{ leverage: clamp01_50(Number(e.target.value)) })} className="w-full" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Portfolio Composition */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">Portfolio Composition</h3>
                {selected.length > 0 && (
                  <button 
                    onClick={autoBalanceAllocations}
                    className="text-[#98FCE4] text-sm hover:underline"
                  >
                    Auto Balance
                  </button>
                )}
              </div>
              
              <div className="glass-card rounded-[12px] p-4 space-y-4">
                {selected.length === 0 ? (
                  /* Empty State */
                  <div className="text-center py-8">
                    <div className="text-[color:var(--color-muted-foreground)] mb-2">
                      No assets selected
                    </div>
                    <div className="text-[color:var(--color-muted-foreground)] text-sm">
                      Search and add assets above to start building your portfolio
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Each asset allocation */}
                    {selected.map((s) => {
                      const percentage = composition.allocations[s.symbol] || 0;
                      const hybeAmount = getAssetAmount(s.symbol);
                      return (
                        <div key={s.symbol} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="text-white font-medium text-sm">
                              {s.symbol}
                              <span className="text-[color:var(--color-muted-foreground)] ml-1 text-xs">
                                ({s.name})
                              </span>
                            </div>
                            <div className="text-white text-sm">
                              {hybeAmount.toFixed(2)} HYPE
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                step="1"
                                value={Math.round(percentage)} 
                                onChange={(e) => updateAllocation(s.symbol, Number(e.target.value))}
                                className="w-full"
                              />
                            </div>
                            <div className="glass-input rounded-[8px] w-20">
                              <input 
                                type="number" 
                                min="0" 
                                max="100" 
                                step="1"
                                value={Math.round(percentage)} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '') {
                                    updateAllocation(s.symbol, 0);
                                  } else {
                                    const num = parseInt(val) || 0;
                                    updateAllocation(s.symbol, Math.max(0, Math.min(100, num)));
                                  }
                                }}
                                className="no-spinner w-full px-2 py-1 text-white bg-transparent border-none outline-none text-center text-sm" 
                              />
                            </div>
                            <span className="text-[color:var(--color-muted-foreground)] text-sm">%</span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
                
                {/* Total Investment */}
                <div className="border-t border-[color:var(--color-border)] pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-white font-medium">Total Investment</div>
                    <div className="flex items-center gap-2">
                      <div className="glass-input rounded-[8px] w-32">
                        <input 
                          type="number" 
                          min="0"
                          value={composition.totalAmount} 
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setTotalAmount(val);
                          }}
                          className="no-spinner w-full px-3 py-2 text-white bg-transparent border-none outline-none text-right" 
                        />
                      </div>
                      <span className="text-white">HYPE</span>
                    </div>
                  </div>
                  
                  {/* Allocation Warning */}
                  {selected.length > 0 && allocationWarning && (
                    <div className="text-yellow-400 text-xs mb-2">
                      {allocationWarning}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <h3 className="text-white font-medium">Preview</h3>
            <div className="glass-card rounded-[12px] p-4">
              <div className="inline-flex rounded-xl p-1 bg-[color:var(--color-card)] border border-[color:var(--color-border)] mb-3 backdrop-blur-md">
                {(["1H", "1D"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      period === p
                        ? "bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]"
                        : "text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)]"
                    }`}
                    aria-pressed={period === p}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="h-56 pr-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={previewData ?? []}>
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: "#A0B5B2", fontSize: 11 }} 
                      interval={period === "1H" ? "preserveStartEnd" : Math.ceil((previewData?.length || 0) / 6)}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: "#A0B5B2", fontSize: 11 }} 
                      width={40}
                    />
                    <Tooltip 
                      content={<PreviewCustomTooltip timeframe={period} />}
                      cursor={{ stroke: "#98FCE4", strokeWidth: 1, strokeDasharray: "3 3" }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#98FCE4" 
                      fill="#98FCE4" 
                      fillOpacity={0.2} 
                      strokeWidth={2}
                      activeDot={{ 
                        r: 4, 
                        fill: "#98FCE4", 
                        strokeWidth: 2, 
                        stroke: "#ffffff" 
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass-card rounded-[12px] p-4 text-[color:var(--color-muted-foreground)] text-sm">
              {previewLoading ? (
                "Building preview…"
              ) : previewData ? (
                "Preview uses live candles weighted by allocation, side, and leverage."
              ) : selected.length === 0 ? (
                "No assets selected — showing placeholder preview."
              ) : (
                <div>
                  <div className="text-yellow-400">Preview unavailable</div>
                  <div className="text-xs mt-1">
                    Total allocation: {totalAllocation.toFixed(1)}% 
                    {Math.abs(totalAllocation - 100) > 1 && " (should be 100%)"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 glass-card border-t border-[color:var(--color-border)]">
        <div className="mx-auto max-w-[1440px] px-6 py-3 flex items-center justify-between" style={{ fontSize: 12, lineHeight: 1.4 }}>
          <div className="flex gap-8 text-white">
            <div>
              <div className="text-[color:var(--color-muted-foreground)]">Total Cost</div>
              <div>{totalCost.toFixed(2)} HYPE</div>
            </div>
            <div>
              <div className="text-[color:var(--color-muted-foreground)]">Fee</div>
              <div>{feeAmt.toFixed(2)} HYPE</div>
            </div>
            <div>
              <div className="text-[color:var(--color-muted-foreground)]">HYPE Balance</div>
              <div>0.00 HYPE</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-1.5 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]" style={{ fontSize: 12 }}>Inline Swap</button>
            <button 
              onClick={() => setShowLaunchModal(true)}
              disabled={selected.length === 0}
              className="inline-flex items-center justify-center rounded-[12px] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] disabled:bg-[color:var(--color-primary)]/50 disabled:cursor-not-allowed" 
              style={{ fontSize: 12, minWidth: 80, paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12 }}
            >
              Launch
            </button>
          </div>
        </div>
      </div>
      {/* Upload Modal */}
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
      
      {/* Launch Confirmation Modal */}
      <ConfirmLaunchModal
        open={showLaunchModal}
        onClose={() => setShowLaunchModal(false)}
        onConfirm={() => {
          // Close launch modal and show success modal
          setShowLaunchModal(false);
          
          // Mock Launch - Save to localStorage with actual data
          const totalAllocatedPct = Object.values(composition.allocations).reduce((sum, pct) => sum + pct, 0);
          
          // Generate realistic performance chart data based on portfolio composition
          const generatePerformanceData = (days: number) => {
            const data = [];
            let baseValue = 100;
            
            for (let i = 0; i < days; i++) {
              // Simulate realistic portfolio performance
              const volatility = 0.03; // 3% daily volatility
              const randomChange = (Math.random() - 0.5) * 2 * volatility;
              
              // Apply leverage effect from portfolio
              const avgLeverage = selected.reduce((sum, asset) => {
                const weight = (composition.allocations[asset.symbol] || 0) / 100;
                return sum + (asset.leverage * weight);
              }, 0);
              
              const leveragedChange = randomChange * Math.min(avgLeverage, 5); // Cap at 5x for realism
              baseValue += baseValue * leveragedChange;
              
              data.push({
                date: i === 0 ? "D1" : `${i + 1}`,
                value: Math.max(50, baseValue) // Prevent negative values
              });
            }
            
            return data;
          };

          const mockIndex = {
            id: Date.now().toString(),
            name: indexName || "Unnamed Index",
            symbol: ticker || "UNNAMED",
            status: "Active" as const,
            markPx: 100.00,
            currentValue: composition.totalAmount.toLocaleString('en-US', { 
              style: 'currency', 
              currency: 'USD' 
            }).replace('$', '') + ' HYPE',
            nav: "100.00",
            createdAt: new Date().toISOString(),
            composition: selected.map(asset => ({
              asset: asset.name,
              symbol: asset.symbol,
              percentage: composition.allocations[asset.symbol] || 0,
              currentPrice: (50 + Math.random() * 100).toFixed(2), // Mock price
              side: asset.side,
              leverage: asset.leverage
            })),
            position: {
              quantity: composition.totalAmount.toLocaleString('en-US') + " HYPE",
              avgEntryPx: "100.00 HYPE"
            },
            fundingRate: (Math.random() * 0.1 - 0.05).toFixed(3) + "%", // -0.05% to 0.05%
            premium: (Math.random() * 0.2).toFixed(2) + "%", // 0% to 0.2%
            openInterest: ((Math.random() * 5 + 1) * 1000000).toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }),
            dayNtlVlm: ((Math.random() * 2 + 0.5) * 1000000).toLocaleString('en-US', {
              style: 'currency',
              currency: 'USD',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }),
            maxLeverage: Math.max(...selected.map(s => (s.marketType === "spot" ? 1 : s.leverage))).toString() + "x",
            sinceInceptionReturnPct: (Math.random() * 10 - 5).toFixed(2) + "%", // -5% to +5%
            // Performance chart data for different timeframes
            performanceData: {
              "5m": generatePerformanceData(20), // 20 data points for 5m
              "1h": generatePerformanceData(24), // 24 data points for 1h
              "1d": generatePerformanceData(30), // 30 data points for 1d
              "7d": generatePerformanceData(7)   // 7 data points for 7d
            },
            // Additional realistic metrics
            totalAssets: selected.length,
            totalAllocation: Math.round(totalAllocatedPct) + "%",
            creationFee: "0.10 HYPE"
          };

          // Save to localStorage
          const existingIndexes = JSON.parse(localStorage.getItem('mock-indexes') || '[]');
          existingIndexes.push(mockIndex);
          localStorage.setItem('mock-indexes', JSON.stringify(existingIndexes));

          console.log("Mock index launched with real data:", mockIndex);
          
          // Show success modal
          setShowSuccessModal(true);
        }}
        indexName={indexName}
        ticker={ticker}
        selectedAssets={selected.map(asset => ({
          symbol: asset.symbol,
          name: asset.name,
          side: asset.side,
          leverage: asset.leverage,
          hypeAmount: (composition.totalAmount * (composition.allocations[asset.symbol] || 0) / 100),
          usdcAmount: (composition.totalAmount * (composition.allocations[asset.symbol] || 0) / 100),
          allocationPct: composition.allocations[asset.symbol] || 0
        }))}
        totalCost={totalCost}
        feeAmount={feeAmt}
      />
      
      {/* Launch Success Modal */}
      <LaunchSuccessModal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        indexName={indexName}
        ticker={ticker}
      />
    </div>
  );
}
