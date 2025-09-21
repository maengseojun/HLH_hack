"""Utility functions: config loader, formatting, and logging helpers.

Stdlib only. Deterministic numeric formatting and daily-rotated CSV.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Iterable, List
from datetime import datetime, timezone, timedelta
import csv


def load_config(path: str) -> Dict[str, Any]:
    """Load JSON config from path.

    Raises FileNotFoundError or json.JSONDecodeError on error.
    """
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def project_path(*parts: str) -> str:
    """Resolve a path relative to repo root (folder containing this file's parent)."""
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, *parts)


def fmt_usd(x: float) -> str:
    return f"{x:.2f}"


def fmt_usd_signed(x: float) -> str:
    sign = "+" if x >= 0 else "-"
    return f"{sign}{abs(x):.2f}"


def fmt_qty(x: float) -> str:
    return f"{x:.6f}"


# --- Constants ---
KST = timezone(timedelta(hours=9))

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


def fmt_ratio4(x: float) -> str:
    return f"{x:.4f}"


def kst_now_iso() -> str:
    """Return ISO8601 timestamp in Asia/Seoul timezone."""
    return datetime.now(KST).isoformat()


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _csv_file_for_today(csv_dir: str) -> str:
    ensure_dir(csv_dir)
    day = datetime.now(KST).strftime("%Y%m%d")
    return os.path.join(csv_dir, f"rebalance_{day}.csv")


def append_csv_row(row: Dict[str, Any], csv_dir: str) -> None:
    """Append one CSV row with daily rotation in KST.

    Writes header if the file is new or empty. Formats fields deterministically.
    """
    path = _csv_file_for_today(csv_dir)
    file_exists = os.path.exists(path)
    need_header = True
    if file_exists:
        try:
            need_header = os.path.getsize(path) == 0
        except OSError:
            need_header = True

    # Prepare row in header order, formatting numerics.
    def format_value(key: str, val: Any) -> Any:
        if val == "" or val is None:
            return ""
        if key in {"ts", "status", "rebalance_mode", "err_reason"}:
            return str(val)
        if key in {"slot", "orders_count_btc", "orders_count_eth", "btc_slip_bps", "eth_slip_bps", "latency_ms", "slip_cap_bps"}:
            return int(val)
        if key in {"delta_residual"}:
            return fmt_ratio4(float(val))
        if key in {"portvol_ewma", "vol_track_err_pp"}:
            if val == "":
                return ""
            return f"{float(val):.2f}"
        if key in {"funding_btc_bp_day", "funding_eth_bp_day", "fund_residual_bp_day"}:
            return f"{float(val):.1f}"
        # Money/prices, leverage, targets, deltas, nav
        return fmt_usd(float(val))

    values = [format_value(k, row.get(k, "")) for k in CSV_HEADERS]

    with open(path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if need_header:
            writer.writerow(CSV_HEADERS)
        writer.writerow(values)


def append_jsonl(row: Dict[str, Any], json_path: str) -> None:
    """Append one JSON line with stable key order (CSV header order)."""
    dir_ = os.path.dirname(json_path)
    if dir_:
        ensure_dir(dir_)
    ordered = {k: row.get(k, "") for k in CSV_HEADERS}
    import json
    with open(json_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(ordered, ensure_ascii=False, separators=(",", ":")) + "\n")
