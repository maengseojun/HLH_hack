"""Mock market adapter (offline, in-memory)."""

from __future__ import annotations

from typing import Dict, Tuple


class Adapter:
    def __init__(self) -> None:
        self.prices: Dict[str, float] = {"BTC": 60_000.0, "ETH": 2_400.0}
        self.funding_bp_day: Dict[str, float] = {"BTC": 4.0, "ETH": -5.0}
        self.pos_usd: Dict[str, float] = {"BTC": 10_800.0, "ETH": -7_920.0}
        self.cash_usd: float = 10_000.0

    # Interface
    def get_prices(self) -> Tuple[float, float]:
        return (self.prices["BTC"], self.prices["ETH"])

    def get_funding_bp_day(self) -> Tuple[float, float]:
        return (self.funding_bp_day["BTC"], self.funding_bp_day["ETH"])

    def get_positions_usd(self) -> Tuple[float, float]:
        return (self.pos_usd["BTC"], self.pos_usd["ETH"])

    def get_cash_usd(self) -> float:
        return self.cash_usd

    def set_cash_usd(self, new_cash: float) -> None:
        self.cash_usd = float(new_cash)

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
        if side.upper() == "BUY":
            self.pos_usd[asset] = self.pos_usd.get(asset, 0.0) + filled
        elif side.upper() == "SELL":
            self.pos_usd[asset] = self.pos_usd.get(asset, 0.0) - filled
        else:
            raise ValueError(f"Invalid side: {side}")
        return {
            "asset": asset,
            "side": side.upper(),
            "filled_usd": filled,
            "new_pos_usd": self.pos_usd[asset],
        }

    def nudge_prices(self, btc: float | None = None, eth: float | None = None) -> None:
        if btc is not None:
            self.prices["BTC"] = float(btc)
        if eth is not None:
            self.prices["ETH"] = float(eth)

