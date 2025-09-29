"use client";

import { createPortal } from "react-dom";
import { useMemo, useState, useEffect } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, PieChart, Pie, Cell, Tooltip } from "recharts";
import { getCandles, type Candle } from "@/lib/api";

type CompositionItem = { asset: string; symbol?: string; percentage: number; value?: string; currentPrice?: number | string; side?: "long" | "short"; leverage?: number };

export type IndexDetails = {
  name: string;
  symbol: string;
  status?: "Active" | "Redeemed";
  markPx?: number;
  currentValue?: string; // e.g., $2,847.50
  nav?: string;
  composition?: CompositionItem[];
  // Performance chart data
  performanceData?: {
    "5m"?: Array<{ date: string; value: number }>;
    "1h"?: Array<{ date: string; value: number }>;
    "1d"?: Array<{ date: string; value: number }>;
    "7d"?: Array<{ date: string; value: number }>;
  };
  // Optional position + metrics
  position?: { quantity?: number | string; avgEntryPx?: number | string; side?: "long" | "short" };
  fundingRate?: number | string;
  fundingHistory?: Array<{ t: number | string; rate: number }>;
  premium?: number | string;
  openInterest?: number | string;
  dayNtlVlm?: number | string;
  maxLeverage?: number | string;
  sinceInceptionReturnPct?: number | string;
  // Redemption summary (post-close)
  redemption?: {
    perAsset?: Array<{ symbol: string; allocationPct: number; buyPrice?: number | string; sellPrice?: number | string; position?: "long" | "short"; absReturn?: number | string; pctReturn?: number | string }>;
    redeemedAmount?: number | string;
    redeemedValueUSDC?: number | string;
    fees?: number | string;
    slippage?: number | string;
    openedAt?: string;
    closedAt?: string;
  };
};

type Props = {
  open: boolean;
  onClose: () => void;
  index?: IndexDetails | null;
};

// NO MORE MOCK DATA - IndexDetailsModal will only show real API data

const COLORS = ["#98FCE4", "#D7EAE8", "#A0B5B2", "#72a59a", "#5a8a7f"];

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, timeframe }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const change = value > 100 ? `+${(value - 100).toFixed(2)}%` : `${(value - 100).toFixed(2)}%`;
    const changeColor = value > 100 ? "#10b981" : "#ef4444"; // green or red
    
    // Format date based on timeframe
    const formatDate = (dateLabel: string, tf: string = "1d") => {
      if (tf === "5m") {
        // For 5m timeframe, dateLabel is time like "15:30"
        if (dateLabel.includes(':')) {
          return dateLabel; // Already in HH:MM format
        }
      } else if (tf === "1h") {
        // For 1h timeframe, dateLabel is like "15:00"
        if (dateLabel.includes(':')) {
          return dateLabel; // Already in HH:MM format
        }
        if (/^\d{1,2}$/.test(dateLabel)) {
          return `${dateLabel}:00`;
        }
      } else {
        // For 1d timeframe, dateLabel is MM/DD format, tooltip should show MM/DD/YYYY
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
          if (tf === "5m") {
            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
          } else if (tf === "1h") {
            return `${date.getHours().toString().padStart(2, '0')}:00`;
          } else {
            // 1d
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

export default function IndexDetailsModal({ open, onClose, index }: Props) {
  const mode: "active" | "redeemed" = index?.status === "Redeemed" ? "redeemed" : "active";
  const [tf, setTf] = useState<"5m" | "1h" | "1d">("1d");
  const [realTimeData, setRealTimeData] = useState<Array<{ date: string; value: number }> | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!open) {
      setRealTimeData(null);
      setIsLoadingData(false);
      setTf("1d");
    }
  }, [open]);

  // Calculate real performance data from API
  useEffect(() => {
    if (!open || !index?.composition || index.composition.length === 0) {
      console.log("📊 Skipping API fetch:", { open, hasComposition: !!index?.composition, compositionLength: index?.composition?.length });
      return;
    }

    const fetchRealPerformanceData = async () => {
      setIsLoadingData(true);
      try {
        console.log("🔄 Fetching real performance data for", index.name, "timeframe:", tf);
        
        // Process assets sequentially to avoid rate limiting (like in Launch page)
        const series = [];
        const composition = index.composition!;
        
        for (let i = 0; i < Math.min(composition.length, 5); i++) {
          const asset = composition[i];
          
          try {
            // Add delay between requests to avoid rate limiting
            if (i > 0) {
              console.log(`⏳ Waiting 300ms before next request to avoid rate limiting...`);
              await new Promise(resolve => setTimeout(resolve, 300));
            }
            
            console.log(`📊 Getting candles for ${asset.symbol}, tf: ${tf}`);
            let candles: Candle[];
            try {
              const res = await getCandles(asset.symbol!, tf);
              candles = res.candles ?? res.data ?? [];
              console.log(`🕯️ Processed ${candles.length} candles for ${asset.symbol}`);
              
              if (candles.length === 0) {
                console.warn(`❌ No candles for ${asset.symbol}`);
                series.push(null);
                continue;
              }
            } catch (apiError: any) {
              console.warn(`❌ Failed to get candles for ${asset.symbol}:`, apiError.message || apiError);
              series.push(null);
              continue;
            }

            // Extract close prices (support both HyperLiquid format and backend format)
            const closes = candles.map((candle) => {
              // Try HyperLiquid format first (c field)
              if (typeof candle.c === "number") return candle.c;
              // Try backend format (close field)
              if (typeof (candle as any).close === "number") {
                return (candle as any).close;
              }
              return 0;
            });

            const base = closes[0] || 1;
            const sign = asset.side === "short" ? -1 : 1;
            const lev = Math.max(1, asset.leverage || 1);
            const weight = asset.percentage / 100;
            
            console.log(`💰 ${asset.symbol} calculation params:`, { weight, base, sign, lev });
            
            // Calculate NAV contribution
            const navValues = closes.map((price) => {
              const priceReturn = sign * ((price - base) / (base || 1));
              const leveragedReturn = priceReturn * lev;
              return weight * (1 + leveragedReturn);
            });
            
            // Generate appropriate date labels based on timeframe
            const dates = candles.map((c, i) => {
              // Check both t (HyperLiquid format) and timestamp (backend format)
              const timestamp = c.t || (c as any).timestamp;
              if (timestamp) {
                const time = new Date(timestamp);
                if (tf === "5m") {
                  return `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
                } else if (tf === "1h") {
                  return `${time.getHours().toString().padStart(2, '0')}:00`;
                } else {
                  // 1d
                  const month = (time.getMonth() + 1).toString().padStart(2, '0');
                  const date = time.getDate().toString().padStart(2, '0');
                  return `${month}/${date}`;
                }
              }
              return `${i + 1}`;
            });
            series.push({ dates, navValues, weight });
            
          } catch (error) {
            console.error(`❌ getCandles failed for ${asset.symbol}:`, error);
            series.push(null);
          }
        }

        // Combine all assets to calculate portfolio performance
        const validSeries = series.filter(Boolean) as { dates: string[]; navValues: number[]; weight: number }[];
        console.log(`✅ Valid series: ${validSeries.length}/${series.length}`);
        
        if (validSeries.length > 0) {
          const maxLength = Math.max(...validSeries.map(s => s.navValues.length));
          const portfolioPerformance = [];
          
          // Use dates from the first valid series as reference
          const referenceDates = validSeries[0].dates;
          
          for (let i = 0; i < maxLength; i++) {
            let portfolioValue = 100; // Start at 100
            let totalWeight = 0;
            
            validSeries.forEach(({ navValues, weight }) => {
              if (i < navValues.length) {
                portfolioValue += (navValues[i] - weight) * 100; // Convert to percentage
                totalWeight += weight;
              }
            });
            
            // Ensure proper date format for display
            let displayDate = referenceDates[i];
            if (!displayDate) {
              // Generate fallback date based on timeframe if API data doesn't have proper dates
              const now = new Date();
              if (tf === "5m") {
                const time = new Date(now);
                time.setMinutes(now.getMinutes() - ((maxLength - 1 - i) * 5));
                displayDate = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
              } else if (tf === "1h") {
                const time = new Date(now);
                time.setHours(now.getHours() - (maxLength - 1 - i));
                displayDate = `${time.getHours().toString().padStart(2, '0')}:00`;
              } else {
                // 1d - ensure MM/DD format
                const day = new Date(now);
                day.setDate(now.getDate() - (maxLength - 1 - i));
                const month = (day.getMonth() + 1).toString().padStart(2, '0');
                const date = day.getDate().toString().padStart(2, '0');
                displayDate = `${month}/${date}`;
              }
            }
            
            portfolioPerformance.push({
              date: displayDate,
              value: Math.max(10, portfolioValue) // Prevent negative values
            });
          }
          
          console.log("📈 Portfolio performance calculated:", portfolioPerformance.slice(0, 3), "...");
          setRealTimeData(portfolioPerformance);
        } else {
          console.warn("⚠️ No valid asset data available for chart generation");
          // Show error state - all assets failed to load data
          setRealTimeData([]);
        }
        
      } catch (error) {
        console.error("❌ Failed to fetch real performance data:", error);
        setRealTimeData(null);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchRealPerformanceData();
  }, [open, tf, index?.composition, index?.name]);

  const dataByTf = useMemo(() => {
    // Only use real API data - NO MOCK DATA
    if (realTimeData && realTimeData.length > 0) {
      return realTimeData;
    }
    const actualData = index?.performanceData?.[tf];
    if (actualData && actualData.length > 0) {
      return actualData;
    }
    // Return empty array if no real data available
    return [];
  }, [tf, realTimeData, index?.performanceData]);

  if (!open) return null;

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Modal box with capped height and internal scroll */}
      <div className="relative w-full max-w-3xl mx-4 rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-card)]/80 backdrop-blur-md p-6 flex flex-col h-[90vh]">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <div className="text-white text-xl font-semibold">{index?.name ?? "Index Details"}</div>
            {index?.symbol && <div className="text-[color:var(--color-muted-foreground)]">{index.symbol}</div>}
          </div>
          <button
            onClick={onClose}
            className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-1.5 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]"
          >
            Close
          </button>
        </div>
        {/* Scrollable content */}
        {/* Add right gutter so scrollbar doesn't overlap content */}
        <div className="flex-1 overflow-y-auto pr-4 -mr-4 space-y-6">
          {/* Top metrics */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="text-[color:var(--color-muted-foreground)]">Current Price</div>
              <div className="text-white font-medium">{index?.markPx ?? index?.nav ?? index?.currentValue ?? "—"}</div>
            </div>
            <div className="space-y-2">
              <div className="text-[color:var(--color-muted-foreground)]">Status</div>
              <div className="text-white font-medium">{index?.status ?? "Active"}</div>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-white font-medium flex items-center gap-2">
                Performance
                {isLoadingData && (
                  <div className="w-4 h-4 border-2 border-[color:var(--color-primary)] border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              <div className="inline-flex rounded-xl p-1 bg-[color:var(--color-card)] border border-[color:var(--color-border)]">
                {(["5m","1h","1d"] as const).map((t) => (
                  <button 
                    key={t} 
                    onClick={() => setTf(t)} 
                    disabled={isLoadingData}
                    className={`px-2.5 py-1 rounded-lg text-xs ${tf===t?"bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]":"text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)]"} ${isLoadingData ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-48 pr-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataByTf}>
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#A0B5B2", fontSize: 11 }} 
                    interval={tf === "5m" ? "preserveStartEnd" : tf === "1h" ? Math.ceil(dataByTf.length / 8) : Math.ceil(dataByTf.length / 6)}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#A0B5B2", fontSize: 11 }} 
                    width={40}
                  />
                  <Tooltip 
                    content={<CustomTooltip timeframe={tf} />}
                    cursor={{ stroke: "#98FCE4", strokeWidth: 1, strokeDasharray: "3 3" }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#98FCE4" 
                    strokeWidth={2} 
                    dot={false}
                    activeDot={{ 
                      r: 4, 
                      fill: "#98FCE4", 
                      strokeWidth: 2, 
                      stroke: "#ffffff" 
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Position info (Active) */}
          {mode === "active" && (
            <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
              <div className="text-white font-medium mb-3">Position</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-[color:var(--color-muted-foreground)]">Quantity</div>
                  <div className="text-white">{index?.position?.quantity ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[color:var(--color-muted-foreground)]">Avg Entry</div>
                  <div className="text-white">{index?.position?.avgEntryPx ?? "—"}</div>
                </div>
              </div>
            </div>
          )}

          {/* Composition */}
          <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
            <div className="text-white font-medium mb-3">Composition</div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 text-xs text-[color:var(--color-muted-foreground)]">
                <div className="col-span-2">Name</div>
                <div className="col-span-2">Symbol</div>
                <div className="col-span-2">Price</div>
                <div className="col-span-2">Alloc %</div>
                <div className="col-span-2">Side</div>
                <div className="col-span-2">Lev</div>
              </div>
              <div className="space-y-2">
                {(index?.composition ?? []).map((item, i) => (
                  <div key={`${item.asset}-${i}`} className="grid grid-cols-12 items-center">
                    <div className="col-span-2 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-white text-sm">{item.asset}</span>
                    </div>
                    <div className="col-span-2 text-white text-sm">{item.symbol ?? "—"}</div>
                    <div className="col-span-2 text-white text-sm">{item.currentPrice ?? "—"}</div>
                    <div className="col-span-2 text-white text-sm">{item.percentage}%</div>
                    <div className="col-span-2 text-white text-sm">{item.side ?? "—"}</div>
                    <div className="col-span-2 text-white text-sm">{item.leverage ?? "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Allocation */}
          <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
            <div className="text-white font-medium mb-3">Allocation</div>
            <div className="flex items-center gap-6">
              <div className="w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={index?.composition ?? []} cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={2} dataKey="percentage">
                      {(index?.composition ?? []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-4">
                  {(index?.composition ?? []).map((item, i) => (
                    <div key={`legend-${item.asset}-${i}`} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm truncate">{item.symbol}</div>
                        <div className="text-[color:var(--color-muted-foreground)] text-xs">{item.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Metrics (Active) */}
          {mode === "active" && (
            <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
              <div className="text-white font-medium mb-3">Metrics</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <Metric label="Funding rate" value={index?.fundingRate ?? "—"} />
                <Metric label="Premium" value={index?.premium ?? "—"} />
                <Metric label="Open interest" value={index?.openInterest ?? "—"} />
                <Metric label="24h Volume" value={index?.dayNtlVlm ?? "—"} />
                <Metric label="Max leverage" value={index?.maxLeverage ?? "—"} />
                <Metric label="Since inception return" value={index?.sinceInceptionReturnPct ?? "—"} />
              </div>
              {index?.fundingHistory && index.fundingHistory.length > 0 && (
                <div className="mt-3 text-xs text-[color:var(--color-muted-foreground)]">
                  Funding history: {index.fundingHistory.slice(0,6).map((p)=>p.rate).join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Redemption (after close) */}
          {mode === "redeemed" && (
            <div className="space-y-6">
              <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
                <div className="text-white font-medium mb-3">Redemption – Per Asset</div>
                <div className="grid grid-cols-7 text-xs text-[color:var(--color-muted-foreground)] mb-2">
                  <div>Symbol</div><div>Alloc %</div><div>Buy</div><div>Sell</div><div>Side</div><div>Return</div><div>Return %</div>
                </div>
                <div className="space-y-1">
                  {(index?.redemption?.perAsset ?? []).map((r,i)=> (
                    <div key={`${r.symbol}-${i}`} className="grid grid-cols-7 text-sm">
                      <div className="text-white">{r.symbol}</div>
                      <div className="text-white">{r.allocationPct}%</div>
                      <div className="text-white">{r.buyPrice ?? "—"}</div>
                      <div className="text-white">{r.sellPrice ?? "—"}</div>
                      <div className="text-white">{r.position ?? "—"}</div>
                      <div className="text-white">{r.absReturn ?? "—"}</div>
                      <div className="text-white">{r.pctReturn ?? "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
                <div className="text-white font-medium mb-3">Summary</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <Metric label="Redeemed amount" value={index?.redemption?.redeemedAmount ?? "—"} />
                  <Metric label="Redeemed value (USDC)" value={index?.redemption?.redeemedValueUSDC ?? "—"} />
                  <Metric label="Fees" value={index?.redemption?.fees ?? "—"} />
                  <Metric label="Slippage" value={index?.redemption?.slippage ?? "—"} />
                  <Metric label="Opened at" value={index?.redemption?.openedAt ?? "—"} />
                  <Metric label="Closed at" value={index?.redemption?.closedAt ?? "—"} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render at body to avoid transform/stacking context issues
  if (typeof document !== "undefined") {
    return createPortal(modal, document.body);
  }
  return modal;
}

type MetricValue = string | number | null | undefined;

function Metric({ label, value }: { label: string; value: MetricValue }) {
  const display = value ?? "—";
  return (
    <div>
      <div className="text-[color:var(--color-muted-foreground)]">{label}</div>
      <div className="text-white">{display}</div>
    </div>
  );
}
