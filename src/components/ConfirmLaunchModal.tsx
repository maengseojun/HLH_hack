"use client";

import { useState } from "react";

type SelectedAsset = {
  symbol: string;
  name: string;
  side: "long" | "short";
  hypeAmount: number;
  usdcAmount: number;
  allocationPct: number;
  leverage: number;
};

interface ConfirmLaunchModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  indexName: string;
  ticker: string;
  selectedAssets: SelectedAsset[];
  totalCost: number;
  feeAmount: number;
}

export default function ConfirmLaunchModal({
  open,
  onClose,
  onConfirm,
  indexName,
  ticker,
  selectedAssets,
  totalCost,
  feeAmount,
}: ConfirmLaunchModalProps) {
  // Remove step state as success will be handled by separate modal
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  if (!open) return null;

  const handleConfirm = () => {
    if (!riskAcknowledged || !termsAccepted) return;
    onConfirm();
    // Close this modal - success modal will be shown by parent
  };

  const handleShare = () => {
    const shareText = `Created ${indexName} (${ticker}) index with ${selectedAssets.length} assets`;
    if (navigator.share) {
      navigator.share({ text: shareText });
    } else {
      navigator.clipboard.writeText(shareText);
    }
  };

  const handleClose = () => {
    setRiskAcknowledged(false);
    setTermsAccepted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto glass-card rounded-[16px] p-6 m-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Confirm Launch</h2>
              <button
                onClick={handleClose}
                className="text-[color:var(--color-muted-foreground)] hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Summary */}
            <div className="space-y-4 mb-6">
              <div className="glass-input rounded-[12px] p-4">
                <h3 className="text-white font-medium mb-3">Index Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-[color:var(--color-muted-foreground)]">Name</div>
                    <div className="text-white">{indexName || "Unnamed Index"}</div>
                  </div>
                  <div>
                    <div className="text-[color:var(--color-muted-foreground)]">Ticker</div>
                    <div className="text-white">{ticker || "N/A"}</div>
                  </div>
                  <div>
                    <div className="text-[color:var(--color-muted-foreground)]">Assets</div>
                    <div className="text-white">{selectedAssets.length}</div>
                  </div>
                  <div>
                    <div className="text-[color:var(--color-muted-foreground)]">Total Cost</div>
                    <div className="text-white">{totalCost.toFixed(2)} HYPE</div>
                  </div>
                </div>
              </div>

              {/* Asset breakdown */}
              <div className="glass-input rounded-[12px] p-4">
                <h3 className="text-white font-medium mb-3">Asset Breakdown</h3>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {selectedAssets.map((asset) => (
                    <div key={asset.symbol} className="flex items-center justify-between text-sm p-2 rounded-lg bg-white/5">
                      <div className="flex items-center gap-1">
                        <span className="text-white font-medium text-xs">{asset.symbol}</span>
                        <span className={`px-1 py-0.5 rounded text-xs ${
                          asset.side === "long" 
                            ? "bg-green-400/20 text-green-400" 
                            : "bg-red-400/20 text-red-400"
                        }`}>
                          {asset.side}
                        </span>
                        {asset.leverage > 1 && (
                          <span className="text-[color:var(--color-muted-foreground)] text-xs">
                            {asset.leverage}x
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-white text-xs">{asset.allocationPct}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fees */}
              <div className="glass-input rounded-[12px] p-4">
                <div className="flex justify-between items-center">
                  <span className="text-[color:var(--color-muted-foreground)]">Creation Fee (Fixed)</span>
                  <span className="text-white">{feeAmount.toFixed(2)} HYPE</span>
                </div>
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-[color:var(--color-border)]">
                  <span className="text-white font-medium">Total Required</span>
                  <span className="text-white font-medium">{(totalCost + feeAmount).toFixed(2)} HYPE</span>
                </div>
              </div>
            </div>

            {/* Risk checkboxes */}
            <div className="space-y-3 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={riskAcknowledged}
                  onChange={(e) => setRiskAcknowledged(e.target.checked)}
                  className="mt-1 accent-[color:var(--color-primary)]"
                />
                <span className="text-sm text-[color:var(--color-muted-foreground)]">
                  I acknowledge that this index carries significant risk including total loss of capital, 
                  high volatility, and potential liquidation due to leverage.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 accent-[color:var(--color-primary)]"
                />
                <span className="text-sm text-[color:var(--color-muted-foreground)]">
                  I accept the Terms of Service and understand the platform fees and mechanics.
                </span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 rounded-[12px] border border-[color:var(--color-border)] px-4 py-3 text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)] hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!riskAcknowledged || !termsAccepted}
                className="flex-1 rounded-[12px] bg-red-500 px-4 py-3 text-white font-medium hover:bg-red-600 disabled:bg-red-500/50 disabled:cursor-not-allowed"
              >
                Launch Index
              </button>
            </div>
      </div>
    </div>
  );
}