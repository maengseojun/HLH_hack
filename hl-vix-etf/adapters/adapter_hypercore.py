"""Hypercore adapter stub with the same interface.

Replace methods with real implementations when integrating.
"""

from __future__ import annotations

from typing import Tuple


class Adapter:
    def get_nav_usd(self) -> float:  # pragma: no cover - stub
        raise NotImplementedError

    def get_prices(self) -> Tuple[float, float]:  # pragma: no cover - stub
        raise NotImplementedError

    def get_positions_usd(self) -> Tuple[float, float]:  # pragma: no cover - stub
        raise NotImplementedError

    def estimate_slippage_bps(self, asset: str, delta_notional_usd: float) -> int:  # pragma: no cover - stub
        raise NotImplementedError

    def place_order_usd(self, asset: str, side: str, delta_notional_usd: float) -> dict:  # pragma: no cover - stub
        raise NotImplementedError

