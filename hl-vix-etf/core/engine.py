"""One-tick rebalancing engine with logs and metrics row output."""

from __future__ import annotations

from decimal import Decimal
from time import perf_counter
from typing import Any, Dict, Tuple

from core.risk_guard import check_asset_caps, check_leverage, check_slippage
from core.strategy import targets_mode_a, targets_mode_b, risk_parity_weights
from core.vault import Vault
from core.index_store import IndexStore
from utils.timez import now_kst_iso


def _fmt2(x: float | Decimal) -> str:
    return f"{float(x):.2f}"


def _fmt4(x: float) -> str:
    return f"{float(x):.4f}"


def _human_logs(nav: float, L: float, tb: float, te: float, dB: float, dE: float, bp: float, ep: float, pb: float, pe: float) -> None:
    print(f"[PLAN] NAV={_fmt2(nav)} L={L:.2f} Target: BTC {_sign_usd(tb)}, ETH {_sign_usd(te)}")
    print(f"[DELTA] BTC {_sign_usd(dB)}, ETH {_sign_usd(dE)}")
    print(f"[MARK]  BTC ${_fmt2(bp)}, ETH ${_fmt2(ep)}, POS: BTC {_sign_usd(pb)}, ETH {_sign_usd(pe)}")


def _sign_usd(x: float) -> str:
    s = "+" if x >= 0 else "-"
    return f"{s}{abs(x):.2f}"


def engine_tick(*,
    adapter,
    vault: Vault,
    index: IndexStore,
    cfg: Dict[str, Any],
    slot: int,
    mode: str = "A",
    dry_run: bool = False,
    v_target_override: float | None = None,
) -> Dict[str, Any]:
    t0 = perf_counter()
    try:
        btc_px, eth_px = adapter.get_prices()
        fb, fe = adapter.get_funding_bp_day()
    except Exception as e:
        latency_ms = int((perf_counter() - t0) * 1000)
        # Minimal error row when adapter not ready
        nav_before = float(vault.nav((60_000.0, 2_400.0)))
        return _row(slot, mode, nav_before, 0.0, float(cfg.get("L_base", 0.0)), 0.0, 0.0, 0.0, 0.0,
                    0.0, 0.0, 0.0, 0.0, 0.0, 0.0, "", "", 0.0, 0.0, nav_before, 0.0, 0.0, 0.0, "", "",
                    0, 0, nav_before * float(cfg["min_trade_frac"]), cfg["L_max"], cfg["asset_cap"], cfg["slippage_cap_bps"], latency_ms, "ERROR", str(e))
    # Update index (HL-VIX_14d)
    wB, wE = float(cfg["weights"]["BTC"]), float(cfg["weights"]["ETH"])
    hl_vix14 = index.update((btc_px, eth_px), (fb, fe), wB, wE)

    nav_before = float(vault.nav((btc_px, eth_px)))
    pos_b, pos_e = float(vault.positions_usd["BTC"]), float(vault.positions_usd["ETH"])

    if mode.upper() == "B":
        # Mode B: risk-parity weights and leverage to match target vol
        sig_b, sig_e = index.get_sigmas()  # hourly ratios
        sign_b = 1.0 if float(cfg["weights"].get("BTC", 0.0)) >= 0 else -1.0
        sign_e = 1.0 if float(cfg["weights"].get("ETH", 0.0)) >= 0 else -1.0
        wB, wE = risk_parity_weights(sig_b, sig_e, sign_b, sign_e)
        v_proxy_pct = 100.0 * ((wB * sig_b) ** 2 + (wE * sig_e) ** 2) ** 0.5
        v_target_pct = float(v_target_override) if v_target_override is not None else float(hl_vix14)
        eps = 1e-6
        L = min(float(cfg["L_max"]), (max(v_target_pct, 0.0) / max(v_proxy_pct, eps)))
        tb = nav_before * L * wB
        te = nav_before * L * wE
    else:
        tb, te, L = targets_mode_a(nav_before, cfg["weights"], cfg["L_base"])

    dB, dE = tb - pos_b, te - pos_e
    _human_logs(nav_before, L, tb, te, dB, dE, btc_px, eth_px, pos_b, pos_e)

    status = "OK"
    err_reason = ""

    # Guards on targets
    try:
        check_leverage(tb, te, nav_before, float(cfg["L_max"]))
        check_asset_caps(tb, te, nav_before, float(cfg["asset_cap"]))
    except Exception as e:
        status = "ERROR"
        err_reason = str(e)
        latency_ms = int((perf_counter() - t0) * 1000)
        return _row(slot, mode, nav_before, hl_vix14, L, btc_px, eth_px, pos_b, pos_e, tb, te, dB, dE,
                    0.0, 0.0, "", "", pos_b, pos_e, nav_before, fb, fe, 0.0, "", "",
                    0, 0, nav_before * float(cfg["min_trade_frac"]), cfg["L_max"], cfg["asset_cap"], cfg["slippage_cap_bps"], latency_ms, status, err_reason)

    # Trading loop
    min_trade = nav_before * float(cfg["min_trade_frac"]) if nav_before > 0 else 0.0
    cap_bps = int(cfg["slippage_cap_bps"])
    ord_b = 0.0
    ord_e = 0.0
    slp_b: Any = ""
    slp_e: Any = ""
    orders_b = 0
    orders_e = 0
    pos_b_after = pos_b
    pos_e_after = pos_e

    for asset, delta, px in (("BTC", dB, btc_px), ("ETH", dE, eth_px)):
        if abs(delta) < min_trade:
            print(f"[SKIP] {asset} reason=minTrade delta={_sign_usd(delta)} thresh={_fmt2(min_trade)}")
            continue
        try:
            # splitting heuristic: up to 3 chunks if large
            chunks = 1 if abs(delta) <= 5000 else 3
            part = delta / chunks
            for i in range(chunks):
                slp = check_slippage(adapter, asset, part, cap_bps)
                if asset == "BTC":
                    slp_b = slp
                else:
                    slp_e = slp
                side = "BUY" if part > 0 else "SELL"
                qty = abs(part) / px if px else 0.0
                if dry_run:
                    print(f"[ORDER] {asset} {side} (dry-run) delta_usd={_fmt2(abs(part))} qty={qty:.6f} px={_fmt2(px)} slp={slp}")
                else:
                    res = adapter.place_order_usd(asset, side, abs(part))
                    if asset == "BTC":
                        pos_b_after = float(res["new_pos_usd"])  # usd notional
                        vault.positions_usd["BTC"] = Decimal(str(pos_b_after))
                    else:
                        pos_e_after = float(res["new_pos_usd"])  # usd notional
                        vault.positions_usd["ETH"] = Decimal(str(pos_e_after))
                    print(f"[ORDER] {asset} {side} delta_usd={_fmt2(abs(part))} qty={qty:.6f} px={_fmt2(px)} slp={slp} new_pos={_sign_usd(res['new_pos_usd'])}")
                if asset == "BTC":
                    ord_b += abs(part)
                    orders_b += 1
                else:
                    ord_e += abs(part)
                    orders_e += 1
        except Exception as e:
            status = "ERROR"
            if err_reason:
                err_reason += "; "
            err_reason += f"{asset}: {e}"

    nav_after = float(vault.nav((btc_px, eth_px)))  # PnL accrual
    latency_ms = int((perf_counter() - t0) * 1000)

    # KPIs
    delta_residual = abs(pos_b_after + pos_e_after) / max(nav_after, 1e-9)
    fund_residual = 10_000.0 * abs(pos_b_after * fb / 10_000.0 + pos_e_after * fe / 10_000.0) / max(nav_after, 1e-9)
    portvol = ""  # optional; left blank in minimal build
    v_err = ""

    return _row(slot, mode, nav_before, hl_vix14, L, btc_px, eth_px, pos_b, pos_e, tb, te, dB, dE,
                ord_b, ord_e, slp_b, slp_e, pos_b_after, pos_e_after, nav_after, fb, fe, fund_residual, portvol, v_err,
                orders_b, orders_e, min_trade, cfg["L_max"], cfg["asset_cap"], cfg["slippage_cap_bps"], latency_ms, status, err_reason)


def _row(slot: int, mode: str, nav_before: float, hl_vix14: float, L: float, btc_px: float, eth_px: float,
         pb: float, pe: float, tb: float, te: float, dB: float, dE: float, ord_b: float, ord_e: float,
         slp_b: Any, slp_e: Any, pb_a: float, pe_a: float, nav_after: float, fb: float, fe: float,
         fund_resid: float, portvol: Any, v_err: Any, orders_b: int, orders_e: int, min_trade: float,
         L_max: float, asset_cap: float, slip_cap_bps: int, latency_ms: int, status: str, err_reason: str) -> Dict[str, Any]:
    return {
        "ts": now_kst_iso(),
        "slot": int(slot),
        "rebalance_mode": mode.upper(),
        "nav_before": nav_before,
        "hl_vix14": round(hl_vix14, 2),
        "L_used": L,
        "btc_px": btc_px,
        "eth_px": eth_px,
        "btc_pos_usd_before": pb,
        "eth_pos_usd_before": pe,
        "btc_target_usd": tb,
        "eth_target_usd": te,
        "btc_delta_usd": dB,
        "eth_delta_usd": dE,
        "btc_order_usd": ord_b,
        "eth_order_usd": ord_e,
        "btc_slip_bps": slp_b,
        "eth_slip_bps": slp_e,
        "btc_pos_usd_after": pb_a,
        "eth_pos_usd_after": pe_a,
        "nav_after": nav_after,
        "delta_residual": abs(pb_a + pe_a) / max(nav_after, 1e-9),
        "funding_btc_bp_day": fb,
        "funding_eth_bp_day": fe,
        "fund_residual_bp_day": fund_resid,
        "portvol_ewma": portvol,
        "vol_track_err_pp": v_err,
        "orders_count_btc": orders_b,
        "orders_count_eth": orders_e,
        "min_trade_usd": min_trade,
        "L_max": L_max,
        "asset_cap": asset_cap,
        "slip_cap_bps": slip_cap_bps,
        "latency_ms": latency_ms,
        "status": status,
        "err_reason": err_reason,
    }


def _fast_proxy_vol(nav_before: float, vault: Vault, pxs: Tuple[float, float]) -> float:
    # Very lightweight proxy: use last two NAV samples if available; else return small baseline
    # Minimal implementation keeps it trivial; engine leaves portvol blank for now
    return 10.0  # % placeholder to allow Mode B scaling without external state
