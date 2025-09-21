"""Simple ETF vault accounting (ERC-4626-like, simplified)."""

from __future__ import annotations

from decimal import Decimal
from typing import Dict, Tuple


class Vault:
    def __init__(self, cash_usd: Decimal = Decimal("10000")) -> None:
        self.cash: Decimal = cash_usd
        self.positions_usd: Dict[str, Decimal] = {"BTC": Decimal("0"), "ETH": Decimal("0")}
        self.total_shares: Decimal = Decimal("10000")
        self.last_px: Dict[str, Decimal] = {}

    # NAV and PPS
    def nav(self, pxs: Tuple[float, float]) -> Decimal:
        # PnL accrual from last_px on existing positions
        btc_px, eth_px = [Decimal(str(x)) for x in pxs]
        if "BTC" in self.last_px and self.last_px["BTC"] > 0:
            qty_b = (self.positions_usd["BTC"] / self.last_px["BTC"]) if self.last_px["BTC"] != 0 else Decimal("0")
            self.cash += qty_b * (btc_px - self.last_px["BTC"])  # PnL
        if "ETH" in self.last_px and self.last_px["ETH"] > 0:
            qty_e = (self.positions_usd["ETH"] / self.last_px["ETH"]) if self.last_px["ETH"] != 0 else Decimal("0")
            self.cash += qty_e * (eth_px - self.last_px["ETH"])  # PnL
        # update last px for next tick
        self.last_px["BTC"] = btc_px
        self.last_px["ETH"] = eth_px
        return self.cash

    def price_per_share(self, pxs: Tuple[float, float]) -> Decimal:
        return (self.nav(pxs) / self.total_shares) if self.total_shares != 0 else Decimal("0")

    # Mutations
    def deposit(self, usd: Decimal, pxs: Tuple[float, float]) -> Decimal:
        nav = self.nav(pxs)
        pps = self.price_per_share(pxs) if self.total_shares > 0 else Decimal("1")
        shares = (usd / pps) if pps != 0 else usd
        self.cash += usd
        self.total_shares += shares
        return shares

    def withdraw(self, shares: Decimal, pxs: Tuple[float, float]) -> Decimal:
        pps = self.price_per_share(pxs)
        usd = shares * pps
        self.cash -= usd
        self.total_shares -= shares
        return usd

