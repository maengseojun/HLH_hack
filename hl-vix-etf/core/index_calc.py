"""HL-VIX_14d EWMA index calculator (minimal)."""

from __future__ import annotations

from math import log, sqrt
from typing import Dict, Tuple


class IndexCalculator:
    def __init__(self, alpha: float = 0.10, beta: float = 0.20, kF: float = 8.0) -> None:
        self.alpha = alpha
        self.beta = beta
        self.kF = kF
        self.last_px: Dict[str, float] = {}
        self.ewma_var: Dict[str, float] = {"BTC": 0.0, "ETH": 0.0}
        self.ewma_fund: Dict[str, float] = {"BTC": 0.0, "ETH": 0.0}

    def update(self, pxs: Tuple[float, float], fund_bps_day: Tuple[float, float], wB: float, wE: float) -> float:
        btc_px, eth_px = pxs
        fb, fe = fund_bps_day
        for asset, px in (("BTC", btc_px), ("ETH", eth_px)):
            if asset not in self.last_px or self.last_px[asset] <= 0:
                self.last_px[asset] = px
        # Returns
        r_b = log(btc_px / self.last_px["BTC"]) if self.last_px["BTC"] > 0 else 0.0
        r_e = log(eth_px / self.last_px["ETH"]) if self.last_px["ETH"] > 0 else 0.0
        # EWMA var
        a = self.alpha
        self.ewma_var["BTC"] = (1 - a) * self.ewma_var["BTC"] + a * (r_b * r_b)
        self.ewma_var["ETH"] = (1 - a) * self.ewma_var["ETH"] + a * (r_e * r_e)
        # EWMA funding (bps/day squared proxy)
        b = self.beta
        self.ewma_fund["BTC"] = (1 - b) * self.ewma_fund["BTC"] + b * ((fb / 10_000.0) ** 2)
        self.ewma_fund["ETH"] = (1 - b) * self.ewma_fund["ETH"] + b * ((fe / 10_000.0) ** 2)

        # Update last px
        self.last_px["BTC"] = btc_px
        self.last_px["ETH"] = eth_px

        # HL-VIX_14d (percent)
        w_sum = abs(wB) + abs(wE)
        wBn = abs(wB) / w_sum if w_sum else 0.5
        wEn = abs(wE) / w_sum if w_sum else 0.5
        var = wBn * self.ewma_var["BTC"] + wEn * self.ewma_var["ETH"]
        fund = wBn * self.ewma_fund["BTC"] + wEn * self.ewma_fund["ETH"]
        vix = 100.0 * sqrt(max(var + self.kF * fund, 0.0))
        return vix

