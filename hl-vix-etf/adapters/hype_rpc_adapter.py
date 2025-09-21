"""HypeRPC adapter using urllib; ENV-driven with safe local fallback.

ENV
- HYPE_RPC_URL: base URL for RPC. If unset or HTTP fails, falls back to local mode.
- HYPE_API_KEY: optional bearer token
- HYPE_FORCE_REMOTE=1: force HTTP and raise on failure (no fallback)
- Optional direct feed envs for quick demos:
  - HYPE_BTC_PX, HYPE_ETH_PX (floats)
  - HYPE_FB_BPD, HYPE_FE_BPD (floats, bps/day)
"""

from __future__ import annotations

import json
import os
import time
from typing import Tuple
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen


def _env_float(name: str, default: float | None = None) -> float | None:
    v = os.getenv(name)
    if v is None:
        return default
    try:
        return float(v)
    except ValueError:
        return default


class Adapter:
    def __init__(self, base: str | None = None, api_key: str | None = None, force_remote: bool | None = None) -> None:
        # Default to hackathon public endpoint if not provided
        default_base = "https://hlh-builders-jp-testnet.hyperpc.app"
        self.base = base or os.getenv("HYPE_RPC_URL") or os.getenv("HYPE_RPC") or default_base
        self.api_key = api_key or os.getenv("HYPE_API_KEY")
        self.force_remote = (force_remote if force_remote is not None else (os.getenv("HYPE_FORCE_REMOTE") == "1"))
        # local fallback state (mock-like)
        self._pos_b = 10_800.0
        self._pos_e = -7_920.0
        self._cash = 10_000.0

    # --- HTTP helpers (minimal) ---
    def _req(self, method: str, path: str, payload: dict | None = None) -> dict:
        if not self.base:
            raise RuntimeError("HypeRPC unavailable: set HYPE_RPC_URL")
        url = self.base.rstrip("/") + path
        data = None
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
        for i in range(3):
            try:
                req = Request(url, data=data, headers=headers, method=method)
                with urlopen(req, timeout=10) as r:
                    body = r.read()
                    return json.loads(body.decode("utf-8")) if body else {}
            except (URLError, HTTPError) as e:
                if i == 2:
                    raise RuntimeError(f"HypeRPC HTTP error: {e}")
                time.sleep(0.5 * (i + 1))
        raise RuntimeError("HypeRPC unreachable")

    # --- Interface ---
    def get_prices(self) -> Tuple[float, float]:
        # Fast path via ENV overrides
        eb = _env_float("HYPE_BTC_PX")
        ee = _env_float("HYPE_ETH_PX")
        if eb is not None and ee is not None:
            return (float(eb), float(ee))
        # Remote path (define actual endpoint contract as needed)
        if self.base:
            # Example placeholder: expecting {"BTC": 60000.0, "ETH": 2400.0}
            data = self._req("GET", "/prices")
            if "BTC" in data and "ETH" in data:
                return float(data["BTC"]), float(data["ETH"])
        if self.force_remote:
            raise RuntimeError("HypeRPC prices unavailable")
        # Local fallback
        return (60_000.0, 2_400.0)

    def get_funding_bp_day(self) -> Tuple[float, float]:
        fb = _env_float("HYPE_FB_BPD")
        fe = _env_float("HYPE_FE_BPD")
        if fb is not None and fe is not None:
            return float(fb), float(fe)
        if self.base:
            data = self._req("GET", "/funding")  # placeholder
            if "BTC" in data and "ETH" in data:
                return float(data["BTC"]), float(data["ETH"])
        if self.force_remote:
            raise RuntimeError("HypeRPC funding unavailable")
        return (4.0, -5.0)

    def get_positions_usd(self) -> Tuple[float, float]:
        if self.base:
            try:
                data = self._req("GET", "/positions")  # placeholder
                if "BTC" in data and "ETH" in data:
                    return float(data["BTC"]), float(data["ETH"])
            except RuntimeError:
                if self.force_remote:
                    raise
        return (self._pos_b, self._pos_e)

    def get_cash_usd(self) -> float:
        if self.base:
            try:
                data = self._req("GET", "/balance")  # placeholder
                if "cash" in data:
                    return float(data["cash"])
            except RuntimeError:
                if self.force_remote:
                    raise
        return self._cash

    def set_cash_usd(self, new_cash: float) -> None:
        # local fallback only
        self._cash = float(new_cash)

    def estimate_slippage_bps(self, asset: str, delta_usd: float) -> int:
        # Simple heuristic or use orderbook snapshot if available
        a = abs(delta_usd)
        if a <= 1_000:
            return 5
        if a <= 5_000:
            return 12
        if a <= 20_000:
            return 25
        return 35

    def place_order_usd(self, asset: str, side: str, delta_usd: float) -> dict:
        # Remote path is exchange-managed; here we provide a local fallback mutation.
        filled = abs(float(delta_usd))
        if self.base and self.force_remote:
            # Placeholder — implement actual order route
            raise RuntimeError("HypeRPC order placement not configured")
        if asset == "BTC":
            self._pos_b += filled if side.upper() == "BUY" else -filled
            newp = self._pos_b
        else:
            self._pos_e += filled if side.upper() == "BUY" else -filled
            newp = self._pos_e
        return {"asset": asset, "side": side.upper(), "filled_usd": filled, "new_pos_usd": newp}

    def nudge_prices(self, btc: float | None = None, eth: float | None = None) -> None:
        # Not applicable for RPC
        pass
