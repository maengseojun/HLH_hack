"""Risk guards for leverage/caps/slippage."""

from __future__ import annotations


def check_leverage(target_b: float, target_e: float, nav: float, L_max: float) -> None:
    if nav <= 0:
        raise ValueError("NAV must be positive")
    lev = (abs(target_b) + abs(target_e)) / nav
    if lev > L_max:
        raise ValueError(f"leverage {lev:.4f} exceeds cap {L_max:.4f}")


def check_asset_caps(target_b: float, target_e: float, nav: float, cap: float) -> None:
    limit = cap * nav
    if abs(target_b) > limit:
        raise ValueError("BTC target exceeds per-asset cap")
    if abs(target_e) > limit:
        raise ValueError("ETH target exceeds per-asset cap")


def check_slippage(adapter, asset: str, delta_usd: float, cap_bps: int) -> int:
    bps = int(adapter.estimate_slippage_bps(asset, delta_usd))
    if bps > int(cap_bps):
        raise ValueError(f"slippage {bps}bps exceeds cap {cap_bps}bps")
    return bps

