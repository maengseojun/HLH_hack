"use client";

import { useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from "recharts";

const data7d = [
  { date: "Day 1", value: 100 },
  { date: "Day 2", value: 105 },
  { date: "Day 3", value: 98 },
  { date: "Day 4", value: 112 },
  { date: "Day 5", value: 108 },
  { date: "Day 6", value: 115 },
  { date: "Day 7", value: 122 },
];

const data1m = Array.from({ length: 30 }).map((_, i) => ({
  date: `D${i + 1}`,
  value: 100 + Math.round(Math.sin(i / 3) * 10 + i * 0.7),
}));

export default function LaunchPage() {
  const [period, setPeriod] = useState<"7D" | "1M">("7D");
  const chartData = useMemo(() => (period === "7D" ? data7d : data1m), [period]);

  return (
    <div className="w-full min-h-[70vh]">
      <div className="ui-scale">
      <section className="px-2 pb-6 border-b border-[color:var(--color-border)]">
        <h3 className="text-white font-bold mb-2">Launch</h3>
        <p className="text-[color:var(--color-muted-foreground)]">Create, preview, and launch instantly</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8">
        {/* Basics */}
        <div className="space-y-4">
          <h3 className="text-white font-medium">Basics</h3>
          <div className="space-y-3">
            <div>
              <div className="text-[color:var(--color-muted-foreground)] mb-1">Index Name</div>
              <input placeholder="Enter index name" className="w-full rounded-[12px] bg-[color:var(--color-input-background)] border border-[color:var(--color-border)] px-3 py-2 text-white" />
            </div>
            <div>
              <div className="text-[color:var(--color-muted-foreground)] mb-1">Ticker</div>
              <input placeholder="e.g., MYIDX" className="w-full rounded-[12px] bg-[color:var(--color-input-background)] border border-[color:var(--color-border)] px-3 py-2 text-white" />
            </div>
            <div>
              <div className="text-[color:var(--color-muted-foreground)] mb-1">Cover Image</div>
              <div className="flex gap-2">
                <input placeholder="Upload image" className="flex-1 rounded-[12px] bg-[color:var(--color-input-background)] border border-[color:var(--color-border)] px-3 py-2 text-white" />
                <button className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-2 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]">Upload</button>
              </div>
            </div>
            <div>
              <div className="text-[color:var(--color-muted-foreground)] mb-1">Description</div>
              <textarea rows={3} placeholder="Describe your index" className="w-full rounded-[12px] bg-[color:var(--color-input-background)] border border-[color:var(--color-border)] px-3 py-2 text-white" />
            </div>
            <div>
              <div className="text-[color:var(--color-muted-foreground)] mb-1">Social Link (Optional)</div>
              <input placeholder="https://" className="w-full rounded-[12px] bg-[color:var(--color-input-background)] border border-[color:var(--color-border)] px-3 py-2 text-white" />
            </div>
          </div>
        </div>

        {/* Components */
        }
        <div className="space-y-4">
          <h3 className="text-white font-medium">Components</h3>
          <div className="relative">
            <input placeholder="Search assets..." className="w-full rounded-[12px] bg-[color:var(--color-input-background)] border border-[color:var(--color-border)] px-3 py-2 text-white" />
          </div>
          <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4 text-[color:var(--color-muted-foreground)]">
            Asset list and controls will appear here.
          </div>
          <LeverageControl />
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <h3 className="text-white font-medium">Preview</h3>
          <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
            <div className="inline-flex rounded-xl p-1 bg-[color:var(--color-card)] border border-[color:var(--color-border)] mb-3 backdrop-blur-md">
              {(["7D","1M"] as const).map((p) => (
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
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#A0B5B2" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#A0B5B2" }} />
                  <Area type="monotone" dataKey="value" stroke="#98FCE4" fill="#98FCE4" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4 text-[color:var(--color-muted-foreground)]">
            Performance metrics placeholder
          </div>
        </div>
      </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-[color:var(--color-input-background)] border-t border-[color:var(--color-border)]">
        <div className="mx-auto max-w-[1440px] px-6 py-3 flex items-center justify-between" style={{ fontSize: 14, lineHeight: 1.4 }}>
          <div className="flex gap-8 text-white">
            <div>
              <div className="text-[color:var(--color-muted-foreground)]">Total Cost</div>
              <div>$0.00</div>
            </div>
            <div>
              <div className="text-[color:var(--color-muted-foreground)]">Fee</div>
              <div>$0.00</div>
            </div>
            <div>
              <div className="text-[color:var(--color-muted-foreground)]">HYPE Balance</div>
              <div>$0.00</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-1.5 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]" style={{ fontSize: 12 }}>Inline Swap</button>
            <button className="inline-flex items-center justify-center rounded-[12px] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)]" style={{ fontSize: 12, minWidth: 60, paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12 }}>
              Launch
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeverageControl() {
  const [lev, setLev] = useState<number>(1);

  const clamp = (v: number) => Math.max(1, Math.min(50, Math.round(v)));

  return (
    <div>
      <div className="text-[color:var(--color-muted-foreground)] mb-2 flex items-center justify-between">
        <span>Leverage</span>
        <span className="text-white font-medium">{lev}x</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={1}
          max={50}
          value={lev}
          onChange={(e) => setLev(clamp(Number(e.target.value)))}
          className="no-spinner w-24 rounded-[12px] bg-[color:var(--color-input-background)] border border-[color:var(--color-border)] px-3 py-2 text-white"
        />
        <input
          type="range"
          min={1}
          max={50}
          step={1}
          value={lev}
          onChange={(e) => setLev(clamp(Number(e.target.value)))}
          className="flex-1 accent-[color:var(--color-primary)]"
        />
      </div>
      <div className="mt-1 text-xs text-[color:var(--color-muted-foreground)]">Up to 50x leverage.</div>
    </div>
  );
}
