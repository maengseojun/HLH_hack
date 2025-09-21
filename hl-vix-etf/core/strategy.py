"""Strategy targets for Mode A (fixed-L) and Mode B (vol targeting)."""

from __future__ import annotations

from typing import Dict, Tuple


def targets_mode_a(nav: float, weights: Dict[str, float], L_base: float) -> Tuple[float, float, float]:
    L = float(L_base)
    tb = nav * L * float(weights.get("BTC", 0.0))
    te = nav * L * float(weights.get("ETH", 0.0))
    return tb, te, L


def targets_mode_b(nav: float, weights: Dict[str, float], L_max: float, v_target_pct: float, v_proxy_pct: float) -> Tuple[float, float, float]:
    # legacy interface kept for backward compatibility: uses given weights and v_proxy
    eps = 1e-6
    v_t = max(v_target_pct, 0.0) / 100.0
    v_p = max(v_proxy_pct, eps) / 100.0
    L = min(float(L_max), (v_t / v_p))
    tb = nav * L * float(weights.get("BTC", 0.0))
    te = nav * L * float(weights.get("ETH", 0.0))
    return tb, te, L


def risk_parity_weights(sig_b: float, sig_e: float, sign_b: float, sign_e: float) -> Tuple[float, float]:
    """Return signed risk-parity weights normalized to sum of absolute values = 1.

    sign_b/e typically +1 for long BTC, -1 for short ETH.
    """
    inv_b = (1.0 / max(sig_b, 1e-9)) if sig_b > 0 else 0.0
    inv_e = (1.0 / max(sig_e, 1e-9)) if sig_e > 0 else 0.0
    # apply desired signs
    wB_raw = inv_b * (1.0 if sign_b >= 0 else -1.0)
    wE_raw = inv_e * (1.0 if sign_e >= 0 else -1.0)
    s = abs(wB_raw) + abs(wE_raw)
    if s == 0:
        return 0.5, -0.5
    return wB_raw / s, wE_raw / s
