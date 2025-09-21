"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from "recharts";
import UploadModal from "@/components/UploadModal";
import ConfirmLaunchModal from "@/components/ConfirmLaunchModal";
import { getAssets, getCandles, postBasketCalculate, type Asset, type BasketItemInput, type PositionSide, type Candle } from "@/lib/api";

const data7d = [
  { date: "Day 1", value: 100 },
  { date: "2", value: 105 },
  { date: "3", value: 98 },
  { date: "4", value: 112 },
  { date: "5", value: 108 },
  { date: "6", value: 115 },
  { date: "7", value: 122 },
];

const data1d = Array.from({ length: 24 }).map((_, i) => ({
  date: i === 0 ? "H1" : `${i + 1}`,
  value: 100 + Math.round(Math.sin(i / 3) * 8 + i * 0.3),
}));

const clamp01_50 = (v: number) => Math.max(1, Math.min(50, Math.round(v)));
const clamp0_100 = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

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
  hypeAmount: number;
  usdcAmount: number;
  allocationPct: number;
  leverage: number;
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
  const [period, setPeriod] = useState<"1D" | "7D">("7D");
  const fallbackData = useMemo(() => (period === "7D" ? data7d : data1d), [period]);
  const [showUpload, setShowUpload] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  
  // Launch modal
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [indexName, setIndexName] = useState("");
  const [ticker, setTicker] = useState("");

  // Search assets
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    let cancel = false;
    getAssets().then((list) => { if (!cancel) setAssets(list); }).catch(() => {});
    return () => { cancel = true; };
  }, []);
  const filtered = useMemo(() => {
    if (!search) return [] as Asset[];
    const q = search.toLowerCase();
    return assets.filter((a) => a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q)).slice(0, 10);
  }, [assets, search]);

  // Selected basket
  const [selected, setSelected] = useState<SelectedAsset[]>([]);
  const addAsset = (a: Asset) => {
    setSelected((prev) => {
      if (prev.find((s) => s.symbol === a.symbol)) return prev;
      const next: SelectedAsset = {
        symbol: a.symbol,
        name: a.name,
        side: POSITION_SIDES[0],
        hypeAmount: 100,
        usdcAmount: 100,
        allocationPct: 25,
        leverage: 1,
      };
      return [...prev, next];
    });
    setSearch("");
  };
  const updateAsset = (symbol: string, patch: Partial<SelectedAsset>) => {
    setSelected((prev) => prev.map((s) => (s.symbol === symbol ? { ...s, ...patch } : s)));
  };
  const removeAsset = (symbol: string) => setSelected((prev) => prev.filter((s) => s.symbol !== symbol));

  // Allocation validation
  const totalAllocation = useMemo(() => selected.reduce((sum, s) => sum + (s.allocationPct || 0), 0), [selected]);
  const allocationWarning = useMemo(() => {
    if (selected.length === 0) return null;
    const diff = Math.abs(totalAllocation - 100);
    if (diff > 0.1) return `Total allocation: ${totalAllocation.toFixed(1)}% (should be 100%)`;
    return null;
  }, [totalAllocation, selected.length]);

  // Auto-correct allocation to 100%
  const autoCorrectAllocation = () => {
    if (selected.length === 0) return;
    const evenSplit = 100 / selected.length;
    setSelected(prev => prev.map(s => ({ ...s, allocationPct: Math.round(evenSplit * 10) / 10 })));
  };

  const totalCost = useMemo(() => selected.reduce((sum, s) => sum + (Number.isFinite(s.hypeAmount) ? s.hypeAmount : 0), 0), [selected]);
  const feeRate = 0.005;
  const feeAmt = useMemo(() => totalCost * feeRate, [totalCost]);

  // Preview: fetch candles for selected assets and synthesize a combined series
  const [previewData, setPreviewData] = useState<{ date: string; value: number }[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    async function buildPreview() {
      if (selected.length === 0) { setPreviewData(null); return; }
      setPreviewLoading(true);
      try {
        // First, try using the new API endpoint
        const totalWeight = selected.reduce((sum, s) => sum + (s.allocationPct || 0), 0);
        if (Math.abs(totalWeight - 100) < 1) { // If weights are close to 100%
          try {
            const basketItems: BasketItemInput[] = selected.map(s => ({
              symbol: s.symbol,
              weight: (s.allocationPct || 0) / 100,
              position: s.side,
              leverage: s.leverage
            }));
            
            const interval = period === "1D" ? "1d" : "7d";
            const apiResult = await postBasketCalculate({ interval, assets: basketItems });
            
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
        const tf = period === "1D" ? "1d" : "7d";
        const top = selected.slice(0, 5); // cap to reduce requests
        const series = await Promise.all(
          top.map(async (s) => {
            try {
              const res = await getCandles(s.symbol, tf);
              const candles: Candle[] = res.candles ?? res.data ?? [];
              // Calculate NAV-based values instead of normalized
              const closes = candles.map((candle) => {
                if (typeof candle.c === "number") return candle.c;
                if (typeof (candle as { close?: number }).close === "number") {
                  return (candle as { close?: number }).close ?? 0;
                }
                return typeof candle.v === "number" ? candle.v : 0;
              });
              if (closes.length === 0) return null;
              const base = closes[0] || 1;
              const sign = s.side === "short" ? -1 : 1;
              const lev = Math.max(1, s.leverage || 1);
              const weight = (s.allocationPct || 0) / 100;
              const amount = s.hypeAmount || 0;
              
              // Calculate NAV contribution: weight * amount * leverage * price_change
              const navValues = closes.map((price) => {
                const priceReturn = sign * ((price - base) / (base || 1));
                const leveragedReturn = priceReturn * lev;
                return weight * amount * (1 + leveragedReturn);
              });
              
              const dates = candles.map((c, i) => (c.t ? new Date(c.t).toISOString().slice(0, 10) : `${i + 1}`));
              return { dates, navValues, weight, amount };
            } catch {
              return null;
            }
          })
        );
        const valid = series.filter(Boolean) as { dates: string[]; navValues: number[]; weight: number; amount: number }[];
        if (valid.length === 0) { if (!cancel) setPreviewData(null); return; }
        // Align by shortest length
        const len = Math.min(...valid.map((v) => v.navValues.length));
        const dates = valid[0].dates.slice(0, len);
        // Sum all NAV contributions to get total portfolio value
        const combined = Array.from({ length: len }).map((_, i) => {
          const totalNAV = valid.reduce((acc, s) => acc + s.navValues[i], 0);
          return { date: dates[i], value: totalNAV };
        });
        if (!cancel) setPreviewData(combined);
      } finally {
        if (!cancel) setPreviewLoading(false);
      }
    }
    buildPreview();
    return () => { cancel = true; };
  }, [selected, period]);

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
                    onClick={autoCorrectAllocation}
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
              {search && filtered.length>0 && (
                <div className="absolute z-[100] mt-2 w-full glass-dropdown rounded-[12px] p-2">
                  {filtered.map((a)=> (
                    <button key={a.symbol} onClick={()=>addAsset(a)} className="w-full text-left px-3 py-2 rounded-[8px] text-white hover:bg-white/20">
                      <div className="font-medium">{a.symbol}</div>
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
                    <div className="text-white font-medium">{s.symbol} <span className="text-[color:var(--color-muted-foreground)] text-xs">{s.name}</span></div>
                    <button onClick={()=>removeAsset(s.symbol)} className="text-red-400 border border-red-400 rounded-[10px] px-2 py-1 hover:bg-red-400 hover:text-white">Remove</button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-[color:var(--color-muted-foreground)] mb-1">Side</div>
                      <div className="inline-flex rounded-xl p-1 bg-[color:var(--color-card)] border border-[color:var(--color-border)]">
                        {POSITION_SIDES.map((v) => (
                          <button key={v} onClick={()=>updateAsset(s.symbol,{ side: v })} className={`px-2.5 py-1 rounded-lg text-xs ${s.side===v?"bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]":"text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)]"}`}>{v}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-[color:var(--color-muted-foreground)] mb-1">Leverage</div>
                      <div className="flex items-center gap-2">
                        <div className="glass-input rounded-[8px] w-20">
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
                            className="no-spinner w-full px-2 py-1 text-white bg-transparent border-none outline-none" 
                          />
                        </div>
                        <input type="range" min={1} max={50} value={s.leverage} onChange={(e)=>updateAsset(s.symbol,{ leverage: clamp01_50(Number(e.target.value)) })} className="flex-1" />
                      </div>
                    </div>
                    <div>
                      <div className="text-[color:var(--color-muted-foreground)] mb-1">Amount (HYPE)</div>
                      <div className="glass-input rounded-[8px]">
                        <input 
                          type="number" 
                          min={0} 
                          value={s.hypeAmount} 
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              updateAsset(s.symbol, { hypeAmount: 0, usdcAmount: 0 });
                            } else {
                              const num = parseFloat(val) || 0;
                              updateAsset(s.symbol, { hypeAmount: num, usdcAmount: num });
                            }
                          }}
                          className="no-spinner w-full px-3 py-2 text-white bg-transparent border-none outline-none" 
                        />
                      </div>
                      <div className="text-[color:var(--color-muted-foreground)] text-xs mt-1">≈ ${s.usdcAmount.toFixed(2)} USDC</div>
                    </div>
                    <div>
                      <div className="text-[color:var(--color-muted-foreground)] mb-1">Allocation (%)</div>
                      <div className="flex items-center gap-2">
                        <div className="glass-input rounded-[8px] w-20">
                          <input 
                            type="number" 
                            min={0} 
                            max={100} 
                            value={s.allocationPct || ''} 
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                updateAsset(s.symbol, { allocationPct: 25 });
                              } else {
                                const num = parseFloat(val);
                                if (!isNaN(num)) {
                                  updateAsset(s.symbol, { allocationPct: clamp0_100(num) });
                                }
                              }
                            }}
                            className="no-spinner w-full px-2 py-1 text-white bg-transparent border-none outline-none" 
                          />
                        </div>
                        <input type="range" min={0} max={100} value={s.allocationPct} onChange={(e)=>updateAsset(s.symbol,{ allocationPct: clamp0_100(Number(e.target.value)) })} className="flex-1" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <h3 className="text-white font-medium">Preview</h3>
            <div className="glass-card rounded-[12px] p-4">
              <div className="inline-flex rounded-xl p-1 bg-[color:var(--color-card)] border border-[color:var(--color-border)] mb-3 backdrop-blur-md">
                {(["1D", "7D"] as const).map((p) => (
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
                  <AreaChart data={previewData ?? fallbackData}>
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
            <div className="glass-card rounded-[12px] p-4 text-[color:var(--color-muted-foreground)] text-sm">
              {previewLoading ? "Building preview…" : previewData ? "Preview uses live candles weighted by allocation, side, and leverage." : "No assets selected — showing placeholder preview."}
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
              <div>${totalCost.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-[color:var(--color-muted-foreground)]">Fee</div>
              <div>${feeAmt.toFixed(2)}</div>
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
          // Handle actual launch logic here
          console.log("Launching index:", { indexName, ticker, selected });
        }}
        indexName={indexName}
        ticker={ticker}
        selectedAssets={selected}
        totalCost={totalCost}
        feeAmount={feeAmt}
      />
    </div>
  );
}
