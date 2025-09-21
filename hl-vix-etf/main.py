"""CLI for vol-tracking ETF (Modes A/B) + Backtest.

Stdlib only; adapters: mock (offline) and HypeRPC (stub).
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Any, Dict

# Support running as a script without package install
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

import json
from pathlib import Path

from adapters.mock_adapter import Adapter as MockAdapter
from adapters.hype_rpc_adapter import Adapter as HypeAdapter
from core.engine import engine_tick
from core.vault import Vault
from core.index_store import IndexStore
from utils.io_csv import append_csv_row
from utils.io_json import append_jsonl
from core.backtest_util import read_bt_csv, BtAdapter


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Vol-Tracking ETF (Mode A/B) + Backtest")
    sub = p.add_subparsers(dest="cmd")

    run = sub.add_parser("run", help="Run live (mock/hype)")
    run.add_argument("--once", action="store_true", help="Run a single rebalance tick")
    run.add_argument("--loop", action="store_true", help="Run forever, hourly")
    run.add_argument("--mode", choices=["A", "B"], default="A")
    run.add_argument("--v-target", type=float, default=None, help="Override target vol % (Mode B)")
    run.add_argument("--use-adapter", choices=["mock", "hype"], default="mock")
    run.add_argument("--hype-url", default=None, help="Hype RPC base URL (optional)")
    run.add_argument("--hype-key", default=None, help="Hype API key (optional)")
    run.add_argument("--hype-force-remote", action="store_true", help="Force HTTP; no local fallback")
    run.add_argument("--csv", action="store_true", default=True, help="Enable CSV logging (default on)")
    run.add_argument("--no-csv", action="store_false", dest="csv", help="Disable CSV logging")
    run.add_argument("--csv-dir", default=os.path.join(os.getcwd(), "logs"))
    run.add_argument("--json", action="store_true")
    run.add_argument("--json-file", default=os.path.join(os.getcwd(), "logs", "run.jsonl"))
    run.add_argument("--dry-run", action="store_true")
    run.add_argument("--slot-offset", type=int, default=0)
    run.add_argument("--nudge-btc", type=float, default=None)
    run.add_argument("--nudge-eth", type=float, default=None)

    bt = sub.add_parser("backtest", help="Replay hourly CSV and log results")
    bt.add_argument("--data", required=True, help="Path to hourly CSV data")
    bt.add_argument("--mode", choices=["A", "B"], default="A")
    bt.add_argument("--csv", action="store_true", default=True, help="Enable CSV logging (default on)")
    bt.add_argument("--no-csv", action="store_false", dest="csv", help="Disable CSV logging")
    bt.add_argument("--csv-dir", default=os.path.join(os.getcwd(), "bt_logs"))
    bt.add_argument("--json", action="store_true")
    bt.add_argument("--json-file", default=os.path.join(os.getcwd(), "bt_logs", "bt.jsonl"))
    bt.add_argument("--start", default=None)
    bt.add_argument("--end", default=None)
    return p


def _adapter(name: str, *, hype_url: str | None = None, hype_key: str | None = None, hype_force_remote: bool = False):
    if name == "mock":
        return MockAdapter()
    return HypeAdapter(base=hype_url, api_key=hype_key, force_remote=hype_force_remote)


def _maybe_nudge(a, btc, eth) -> None:
    if hasattr(a, "nudge_prices"):
        a.nudge_prices(btc=btc, eth=eth)


def _load_config() -> Dict[str, Any]:
    cfg_path = os.path.join(os.path.dirname(__file__), "config.json")
    with open(cfg_path, "r", encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    parser = _build_parser()
    # Accept legacy flags without subcommand by reparsing
    args, unknown = parser.parse_known_args()
    if args.cmd is None:
        # prepend 'run' before any legacy flags
        argv = ["run"] + unknown
        if not any(x in argv for x in ("--once", "--loop")):
            argv.append("--once")
        args = parser.parse_args(argv)  # type: ignore

    cfg: Dict[str, Any] = _load_config()

    if args.cmd == "backtest":
        _run_backtest(args, cfg)
        return

    # live run
    adapter = _adapter(args.use_adapter, hype_url=args.hype_url, hype_key=args.hype_key, hype_force_remote=args.hype_force_remote)
    index = IndexStore(path=os.path.join(os.path.dirname(__file__), "index_store.json"))
    vault = Vault()
    ticks_seen = 0

    def tick() -> None:
        nonlocal ticks_seen
        if hasattr(adapter, "nudge_prices"):
            adapter.nudge_prices(btc=args.nudge_btc, eth=args.nudge_eth)
        row = engine_tick(adapter=adapter, vault=vault, index=index, cfg=cfg, slot=args.slot_offset + ticks_seen, mode=args.mode, dry_run=args.dry_run, v_target_override=args.v_target)
        if args.csv:
            append_csv_row(row, args.csv_dir)
        if args.json:
            append_jsonl(row, args.json_file)
        ticks_seen += 1

    if args.loop:
        while True:
            tick()
            time.sleep(3600)
    else:
        tick()


if __name__ == "__main__":  # pragma: no cover
    main()


def _run_backtest(args, cfg: Dict[str, Any]) -> None:
    adapter = BtAdapter()
    index = IndexStore(path=os.path.join(os.path.dirname(__file__), "bt_index_store.json"))
    vault = Vault()
    slot = 0
    trades = 0
    slippages = []
    max_nav = float(vault.nav((60_000.0, 2_400.0)))
    max_dd = 0.0
    start = args.start
    end = args.end
    for row in read_bt_csv(args.data):
        # Optional time window filter (lexical ISO ok for demo)
        if start and row.ts < start:
            continue
        if end and row.ts >= end:
            break
        adapter.feed(row.btc_px, row.eth_px, row.btc_funding_bp_day, row.eth_funding_bp_day)
        out = engine_tick(adapter=adapter, vault=vault, index=index, cfg=cfg, slot=slot, mode=args.mode, dry_run=False)
        if args.csv:
            append_csv_row(out, args.csv_dir)
        if args.json:
            append_jsonl(out, args.json_file)
        trades += (out.get("orders_count_btc", 0) or 0) + (out.get("orders_count_eth", 0) or 0)
        if out.get("btc_slip_bps", "") != "":
            slippages.append(int(out["btc_slip_bps"]))
        if out.get("eth_slip_bps", "") != "":
            slippages.append(int(out["eth_slip_bps"]))
        nav = float(out["nav_after"])
        max_nav = max(max_nav, nav)
        dd = (max_nav - nav) / max_nav if max_nav else 0.0
        max_dd = max(max_dd, dd)
        slot += 1
    # Summary
    final_nav = float(vault.nav((adapter.get_prices())))
    total_ret = (final_nav - 10_000.0) / 10_000.0 * 100.0
    p50 = _percentile(slippages, 50)
    p95 = _percentile(slippages, 95)
    print("Backtest Summary:")
    print(f"- Final NAV: {final_nav:.2f} ({total_ret:.2f}%)")
    print(f"- Max Drawdown: {max_dd*100:.2f}%")
    print(f"- Trades: {trades}")
    print(f"- Slippage bps p50/p95: {p50}/{p95}")


def _percentile(vals, p):
    if not vals:
        return 0
    s = sorted(vals)
    k = int((p/100.0) * (len(s)-1))
    return s[k]
