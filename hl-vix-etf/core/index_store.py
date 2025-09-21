"""JSON-backed storage for HL-VIX index state (minimal)."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Tuple
from math import sqrt

from .index_calc import IndexCalculator


class IndexStore:
    def __init__(self, path: str) -> None:
        self.path = path
        self.calc = IndexCalculator()
        self.state: Dict[str, Any] = {}
        self._load()

    def _load(self) -> None:
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                self.state = json.load(f)
                # restore calculator state if present
                self.calc.last_px = self.state.get("last_px", {})
                self.calc.ewma_var = self.state.get("ewma_var", {"BTC": 0.0, "ETH": 0.0})
                self.calc.ewma_fund = self.state.get("ewma_fund", {"BTC": 0.0, "ETH": 0.0})
        except Exception:
            self.state = {}

    def _save(self) -> None:
        os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
        snapshot = {
            "last_px": self.calc.last_px,
            "ewma_var": self.calc.ewma_var,
            "ewma_fund": self.calc.ewma_fund,
        }
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(snapshot, f)

    def update(self, pxs: Tuple[float, float], funds_bp_day: Tuple[float, float], wB: float, wE: float) -> float:
        vix = self.calc.update(pxs, funds_bp_day, wB, wE)
        self._save()
        return vix

    def current(self) -> float:
        # simple proxy: recompute from stored ewma
        wB, wE = 0.6, -0.4
        w_sum = abs(wB) + abs(wE)
        wBn = abs(wB) / w_sum
        wEn = abs(wE) / w_sum
        var = wBn * self.calc.ewma_var.get("BTC", 0.0) + wEn * self.calc.ewma_var.get("ETH", 0.0)
        fund = wBn * self.calc.ewma_fund.get("BTC", 0.0) + wEn * self.calc.ewma_fund.get("ETH", 0.0)
        # duplicate formula; keep kF default 8.0 (inside calc)
        return 100.0 * sqrt(max(var + self.calc.kF * fund, 0.0))

    def get_sigmas(self) -> Tuple[float, float]:
        """Return per-asset EWMA standard deviation (hourly, as ratio not percent)."""
        sb2 = float(self.calc.ewma_var.get("BTC", 0.0))
        se2 = float(self.calc.ewma_var.get("ETH", 0.0))
        return (sqrt(sb2), sqrt(se2))
