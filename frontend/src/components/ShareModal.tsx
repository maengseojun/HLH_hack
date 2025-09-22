"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  name: string;
  symbol: string;
};

export default function ShareModal({ open, onClose, name, symbol }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.pathname = "/index";
    url.search = "";
    url.hash = `#${symbol}`;
    return url.toString();
  }, [symbol]);

  useEffect(() => {
    if (!open) setCopied(null);
  }, [open]);

  if (!open) return null;

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  const summary = `${name} (${symbol}) on CoreIndex`;
  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(summary)}&url=${encodeURIComponent(shareUrl)}`;

  const modal = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-sm mx-4 rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-card)]/80 backdrop-blur-md p-4">
        <div className="text-white font-semibold mb-2">Share</div>
        <div className="text-[color:var(--color-muted-foreground)] text-sm mb-3">{name} ({symbol})</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input readOnly value={shareUrl} className="flex-1 rounded-[12px] bg-[color:var(--color-input-background)] border border-[color:var(--color-border)] px-3 py-2 text-white" />
            <button
              onClick={() => copy(shareUrl, "link")}
              className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-2 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]"
            >
              {copied === "link" ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input readOnly value={summary} className="flex-1 rounded-[12px] bg-[color:var(--color-input-background)] border border-[color:var(--color-border)] px-3 py-2 text-white" />
            <button
              onClick={() => copy(summary, "summary")}
              className="rounded-[12px] border border-[color:var(--color-secondary)] px-3 py-2 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]"
            >
              {copied === "summary" ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="flex items-center justify-between pt-2">
            <a
              href={xUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-[12px] bg-[color:var(--color-primary)] text-[color:var(--color-primary-foreground)] px-4 py-2"
            >
              Share to X
            </a>
            <button
              onClick={onClose}
              className="rounded-[12px] border border-[color:var(--color-secondary)] px-4 py-2 text-[color:var(--color-secondary)] hover:bg-[color:var(--color-secondary)] hover:text-[color:var(--color-background)]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modal, document.body);
  }
  return modal;
}
