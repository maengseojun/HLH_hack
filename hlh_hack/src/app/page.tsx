"use client";

import { useState } from "react";

export default function IndexHubPage() {
  const [filterActive, setFilterActive] = useState(true);
  const [filterRedeemed, setFilterRedeemed] = useState(true);
  const [sortBy, setSortBy] = useState("Date");

  return (
    <div className="w-full min-h-[70vh] ui-scale">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pb-6 border-b border-[color:var(--color-border)]">
        <div className="relative flex-1 max-w-md">
          <input placeholder="Search indexes..." className="w-full rounded-[12px] bg-[color:var(--color-input-background)] border border-[color:var(--color-border)] px-3 py-2 text-white" />
        </div>
        <div className="flex items-center gap-3">
          {/* Filter checkboxes (both checked by default) */}
          <div className="flex items-center gap-4 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-card)]/40 backdrop-blur-md px-3 py-2">
            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                className="size-4 accent-[color:var(--color-primary)]"
                checked={filterActive}
                onChange={(e) => setFilterActive(e.target.checked)}
              />
              <span className="text-sm">Active</span>
            </label>
            <label className="flex items-center gap-2 text-white">
              <input
                type="checkbox"
                className="size-4 accent-[color:var(--color-primary)]"
                checked={filterRedeemed}
                onChange={(e) => setFilterRedeemed(e.target.checked)}
              />
              <span className="text-sm">Redeemed</span>
            </label>
          </div>

          {/* Sort dropdown on the right */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-[12px] bg-[color:var(--color-card)]/40 backdrop-blur-md border border-[color:var(--color-border)] px-3 py-2 text-white"
          >
            <option>Date</option>
            <option>24h Change</option>
            <option>1W Change</option>
            <option>A→Z</option>
            <option>Lowest MDD</option>
          </select>
        </div>
      </div>

      {/* Cards Grid placeholder */}
      <div className="py-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 30 }).map((_, i) => (
          <div key={i} className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-white font-medium">Sample Index {i + 1}</div>
                <div className="text-[color:var(--color-muted-foreground)]">SAMP{i + 1}</div>
              </div>
              <span className="rounded-[8px] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] px-2 py-0.5 text-xs">Active</span>
            </div>
            <div className="text-white font-medium mb-2">$1,234.56</div>
            <div className="text-[color:var(--color-muted-foreground)]">+12.3% (7d)</div>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-2 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]">Details</button>
              <button className="flex-1 rounded-[12px] border border-red-400 px-3 py-2 text-red-400 hover:bg-red-400 hover:text-white">Redeem</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
