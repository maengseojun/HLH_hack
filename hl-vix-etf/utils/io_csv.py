"""CSV writer with KST daily rotation and stable schema."""

from __future__ import annotations

import csv
import os
from typing import Any, Dict, List

from .timez import kst_daystamp

CSV_HEADERS: List[str] = [
    "ts",
    "slot",
    "rebalance_mode",
    "nav_before",
    "hl_vix14",
    "L_used",
    "btc_px",
    "eth_px",
    "btc_pos_usd_before",
    "eth_pos_usd_before",
    "btc_target_usd",
    "eth_target_usd",
    "btc_delta_usd",
    "eth_delta_usd",
    "btc_order_usd",
    "eth_order_usd",
    "btc_slip_bps",
    "eth_slip_bps",
    "btc_pos_usd_after",
    "eth_pos_usd_after",
    "nav_after",
    "delta_residual",
    "funding_btc_bp_day",
    "funding_eth_bp_day",
    "fund_residual_bp_day",
    "portvol_ewma",
    "vol_track_err_pp",
    "orders_count_btc",
    "orders_count_eth",
    "min_trade_usd",
    "L_max",
    "asset_cap",
    "slip_cap_bps",
    "latency_ms",
    "status",
    "err_reason",
]


def ensure_dir(d: str) -> None:
    os.makedirs(d, exist_ok=True)


def _format_value(key: str, val: Any) -> Any:
    if val == "" or val is None:
        return ""
    if key in {"ts", "status", "rebalance_mode", "err_reason"}:
        return str(val)
    if key in {"slot", "orders_count_btc", "orders_count_eth", "btc_slip_bps", "eth_slip_bps", "latency_ms", "slip_cap_bps"}:
        return int(val)
    if key in {"delta_residual", "portvol_ewma", "vol_track_err_pp"}:
        return f"{float(val):.4f}"
    if key in {"funding_btc_bp_day", "funding_eth_bp_day", "fund_residual_bp_day"}:
        return f"{float(val):.1f}"
    return f"{float(val):.2f}"


def append_csv_row(row: Dict[str, Any], csv_dir: str) -> None:
    ensure_dir(csv_dir)
    path = os.path.join(csv_dir, f"rebalance_{kst_daystamp()}.csv")
    need_header = not os.path.exists(path) or os.path.getsize(path) == 0
    values = [_format_value(k, row.get(k, "")) for k in CSV_HEADERS]
    with open(path, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if need_header:
            w.writerow(CSV_HEADERS)
        w.writerow(values)

