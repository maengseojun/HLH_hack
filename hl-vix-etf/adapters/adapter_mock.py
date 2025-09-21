"""Mock adapter for offline rebalancing demo.

Maintains in-memory NAV, prices, and USD positions. No external calls.
"""

from __future__ import annotations

from typing import Dict, Tuple


class Adapter:
    """Mock Adapter interface-compatible with future Hypercore adapter."""

    def __init__(self) -> None:
        self.nav_usd: float = 10_000.0
        self.prices: Dict[str, float] = {"BTC": 60_000.0, "ETH": 2_400.0}
        # Positions in USD notionals: long +, short -
        self.pos_usd: Dict[str, float] = {"BTC": 10_800.0, "ETH": -7_920.0}

    # --- Interface ---
    def get_nav_usd(self) -> float:  # pragma: no cover - trivial
        return self.nav_usd

    def get_prices(self) -> Tuple[float, float]:  # (btc, eth)
        return (self.prices["BTC"], self.prices["ETH"])

    def get_positions_usd(self) -> Tuple[float, float]:  # (btc_pos, eth_pos)
        return (self.pos_usd["BTC"], self.pos_usd["ETH"])

    def estimate_slippage_bps(self, asset: str, delta_notional_usd: float) -> int:
        a = abs(delta_notional_usd)
        if a <= 1_000:
            return 5
        if a <= 5_000:
            return 12
        if a <= 20_000:
            return 25
        return 35

    def place_order_usd(self, asset: str, side: str, delta_notional_usd: float) -> dict:
        filled = abs(float(delta_notional_usd))
        if side.upper() == "BUY":
            self.pos_usd[asset] = self.pos_usd.get(asset, 0.0) + filled
        elif side.upper() == "SELL":
            self.pos_usd[asset] = self.pos_usd.get(asset, 0.0) - filled
        else:  # pragma: no cover - defensive
            raise ValueError(f"Invalid side: {side}")
        return {
            "asset": asset,
            "side": side.upper(),
            "filled_usd": filled,
            "new_pos_usd": self.pos_usd[asset],
        }

    # --- Demo helpers ---
    def nudge_prices(self, btc: float | None = None, eth: float | None = None) -> None:
        if btc is not None:
            self.prices["BTC"] = float(btc)
        if eth is not None:
            self.prices["ETH"] = float(eth)

