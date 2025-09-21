"""Backtest helper: read hourly CSV and simulate ticks with mock-like fills."""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterable, Iterator, Tuple


@dataclass
class BtRow:
    ts: str
    btc_px: float
    eth_px: float
    btc_funding_bp_day: float
    eth_funding_bp_day: float


def read_bt_csv(path: str) -> Iterator[BtRow]:
    with open(path, "r", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            yield BtRow(
                ts=row["ts"],
                btc_px=float(row["btc_px"]),
                eth_px=float(row["eth_px"]),
                btc_funding_bp_day=float(row["btc_funding_bp_day"]),
                eth_funding_bp_day=float(row["eth_funding_bp_day"]),
            )


class BtAdapter:
    """Backtest adapter exposing the same interface, with row-driven market."""

    def __init__(self) -> None:
        self._btc_px = 0.0
        self._eth_px = 0.0
        self._fb = 0.0
        self._fe = 0.0
        self.pos_b = 0.0
        self.pos_e = 0.0
        self.cash = 10_000.0

    def feed(self, btc_px: float, eth_px: float, fb: float, fe: float) -> None:
        self._btc_px, self._eth_px, self._fb, self._fe = btc_px, eth_px, fb, fe

    def get_prices(self) -> Tuple[float, float]:
        return (self._btc_px, self._eth_px)

    def get_funding_bp_day(self) -> Tuple[float, float]:
        return (self._fb, self._fe)

    def get_positions_usd(self) -> Tuple[float, float]:
        return (self.pos_b, self.pos_e)

    def get_cash_usd(self) -> float:
        return self.cash

    def set_cash_usd(self, new_cash: float) -> None:
        self.cash = float(new_cash)

    def estimate_slippage_bps(self, asset: str, delta_usd: float) -> int:
        a = abs(delta_usd)
        if a <= 1_000:
            return 5
        if a <= 5_000:
            return 12
        if a <= 20_000:
            return 25
        return 35

    def place_order_usd(self, asset: str, side: str, delta_usd: float) -> dict:
        filled = abs(float(delta_usd))
        if asset == "BTC":
            self.pos_b += filled if side.upper() == "BUY" else -filled
            newp = self.pos_b
        else:
            self.pos_e += filled if side.upper() == "BUY" else -filled
            newp = self.pos_e
        return {"asset": asset, "side": side.upper(), "filled_usd": filled, "new_pos_usd": newp}

