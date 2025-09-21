"use client";

import { createPortal } from "react-dom";
import { useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";

type CompositionItem = { asset: string; symbol?: string; percentage: number; value?: string; currentPrice?: number | string; side?: "long" | "short"; leverage?: number };

export type IndexDetails = {
  name: string;
  symbol: string;
  status?: "Active" | "Redeemed";
  markPx?: number;
  currentValue?: string; // e.g., $2,847.50
  nav?: string;
  composition?: CompositionItem[];
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

const mockChartData = [
  { date: "D1", value: 100 },
  { date: "2", value: 108 },
  { date: "3", value: 115 },
  { date: "4", value: 125 },
  { date: "5", value: 118 },
  { date: "6", value: 132 },
  { date: "7", value: 142 },
];

const COLORS = ["#98FCE4", "#D7EAE8", "#A0B5B2", "#72a59a", "#5a8a7f"];

export default function IndexDetailsModal({ open, onClose, index }: Props) {
  if (!open) return null;
  const mode: "active" | "redeemed" = index?.status === "Redeemed" ? "redeemed" : "active";
  const [tf, setTf] = useState<"5m" | "1h" | "1d" | "7d">("7d");
  const dataByTf = useMemo(() => mockChartData, [tf]);

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
              <div className="text-white font-medium">Performance</div>
              <div className="inline-flex rounded-xl p-1 bg-[color:var(--color-card)] border border-[color:var(--color-border)]">
                {(["5m","1h","1d","7d"] as const).map((t) => (
                  <button key={t} onClick={() => setTf(t)} className={`px-2.5 py-1 rounded-lg text-xs ${tf===t?"bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]":"text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)]"}`}>{t}</button>
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
                    interval={0}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "#A0B5B2", fontSize: 11 }} 
                    width={40}
                  />
                  <Line type="monotone" dataKey="value" stroke="#98FCE4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Position info (Active) */}
          {mode === "active" && (
            <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
              <div className="text-white font-medium mb-3">Position</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-[color:var(--color-muted-foreground)]">Quantity</div>
                  <div className="text-white">{index?.position?.quantity ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[color:var(--color-muted-foreground)]">Avg Entry</div>
                  <div className="text-white">{index?.position?.avgEntryPx ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[color:var(--color-muted-foreground)]">Side</div>
                  <div className="text-white">{index?.position?.side ?? "—"}</div>
                </div>
              </div>
            </div>
          )}

          {/* Composition + Allocation */}
          <div className="grid grid-cols-2 gap-6">
            <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
              <div className="text-white font-medium mb-3">Composition</div>
              <div className="space-y-2">
                <div className="grid grid-cols-6 text-xs text-[color:var(--color-muted-foreground)]">
                  <div className="col-span-2">Name / Symbol</div>
                  <div>Price</div>
                  <div>Alloc %</div>
                  <div>Side</div>
                  <div>Lev</div>
                </div>
                <div className="space-y-2">
                  {(index?.composition ?? []).map((item, i) => (
                    <div key={`${item.asset}-${i}`} className="grid grid-cols-6 items-center">
                      <div className="col-span-2 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-white">{item.asset}</span>
                        {item.symbol && <span className="text-[color:var(--color-muted-foreground)] text-xs">{item.symbol}</span>}
                      </div>
                      <div className="text-white text-sm">{item.currentPrice ?? "—"}</div>
                      <div className="text-white text-sm">{item.percentage}%</div>
                      <div className="text-white text-sm">{item.side ?? "—"}</div>
                      <div className="text-white text-sm">{item.leverage ?? "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
              <div className="text-white font-medium mb-3">Allocation</div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={index?.composition ?? []} cx="50%" cy="50%" innerRadius={30} outerRadius={70} paddingAngle={2} dataKey="percentage">
                      {(index?.composition ?? []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
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
