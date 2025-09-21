"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type { IndexDetails } from "./IndexDetailsModal";

type Props = {
  open: boolean;
  onClose: () => void;
  index?: IndexDetails | null;
};

function parseCurrency(v?: string | number | null): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export default function RedeemModal({ open, onClose, index }: Props) {
  // Return before any hooks to keep hook order stable across renders
  if (!open || !index) return null;

  const [full, setFull] = useState(true);
  const [amountPct, setAmountPct] = useState(100);
  const [ack, setAck] = useState(false);

  const nav = useMemo(() => parseCurrency(index.nav ?? index.currentValue), [index]);
  const expectedRefund = useMemo(() => {
    const base = full ? nav : (nav * amountPct) / 100;
    const fee = 0.005; // 0.5%
    const net = base * (1 - fee);
    return { base, net };
  }, [full, amountPct, nav]);

  const modal = (
    <div className="fixed inset-0 z-[210] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-card)]/80 backdrop-blur-md p-5">
        <div className="text-white font-semibold mb-2">Redeem {index.name} ({index.symbol})</div>

        {/* Full toggle next to amount label */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-[color:var(--color-muted-foreground)] text-sm">Amount (%)</div>
          <label className="flex items-center gap-2 text-[color:var(--color-muted-foreground)] text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[color:var(--color-primary)]"
              checked={full}
              onChange={(e) => {
                const f = e.target.checked;
                if (f) setAmountPct(100);
                setFull(f);
              }}
            />
            Full
          </label>
        </div>

        {/* Amount inputs (disabled when Full) */}
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={100}
              value={amountPct}
              onChange={(e) => {
                const val = Math.max(1, Math.min(100, Number(e.target.value) || 0));
                setAmountPct(val);
                setFull(val === 100);
              }}
              className="no-spinner w-24 rounded-[12px] bg-[color:var(--color-input-background)] border border-[color:var(--color-border)] px-3 py-2 text-white"
            />
            <input
              type="range"
              min={1}
              max={100}
              value={amountPct}
              onChange={(e) => {
                const val = Number(e.target.value);
                setAmountPct(val);
                setFull(val === 100);
              }}
              className="flex-1 accent-[color:var(--color-primary)]"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4 space-y-2 mb-3">
          <div className="flex justify-between"><span className="text-[color:var(--color-muted-foreground)]">Expected Refund</span><span className="text-white">${expectedRefund.base.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-[color:var(--color-muted-foreground)]">Fee</span><span className="text-white">0.5%</span></div>
          <div className="border-t border-[color:var(--color-border)] pt-2 flex justify-between"><span className="text-white font-medium">Net Amount</span><span className="text-white font-medium">${expectedRefund.net.toFixed(2)}</span></div>
        </div>

        <label className="flex items-center gap-2 text-[color:var(--color-muted-foreground)] text-sm mb-4">
          <input type="checkbox" className="size-4 accent-[color:var(--color-primary)]" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          I acknowledge redemption risks and irreversibility.
        </label>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="rounded-[12px] border border-[color:var(--color-secondary)] px-4 py-2 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]">Cancel</button>
          <button disabled={!ack} className="rounded-[12px] bg-red-500/90 text-white px-5 py-2 disabled:opacity-50">Redeem</button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : modal;
}
