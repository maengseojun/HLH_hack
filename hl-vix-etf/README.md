# Vol-Tracking ETF on Hyperliquid (Mock + HypeRPC Stub)

Minimal, stdlib-only Python project for a volatility-tracking ETF with:
- HL-VIX_14d EWMA index, ETF vault accounting, strategy engine (Mode A: delta & funding hedge, Mode B: vol targeting), adapters (Mock + HypeRPC stub), hourly rebalancing, CSV/JSON logs (KST rotation), and offline backtest.

## Run (live mock)
- Once: `python3 hl-vix-etf/main.py --once --csv --json`
- With price nudges: `python3 hl-vix-etf/main.py --once --csv --nudge-btc 61000 --nudge-eth 2300`
- Loop: `python3 hl-vix-etf/main.py --loop --csv`
- Choose adapter: `--use-adapter mock|hype` (hype requires ENV; see .env.example)

## Backtest
- `python3 hl-vix-etf/main.py backtest --data ./data/hourly.csv --mode A --csv --csv-dir ./bt_logs`
- Input CSV header: `ts,btc_px,eth_px,btc_funding_bp_day,eth_funding_bp_day`

## Config (hl-vix-etf/config.json)
- weights, L_base, L_max, asset_cap, slippage_cap_bps, min_trade_frac, ddl_limit_frac, alpha_fast.

## CSV Schema (per tick)
`ts,slot,rebalance_mode,nav_before,hl_vix14,L_used,btc_px,eth_px,btc_pos_usd_before,eth_pos_usd_before,btc_target_usd,eth_target_usd,btc_delta_usd,eth_delta_usd,btc_order_usd,eth_order_usd,btc_slip_bps,eth_slip_bps,btc_pos_usd_after,eth_pos_usd_after,nav_after,delta_residual,funding_btc_bp_day,funding_eth_bp_day,fund_residual_bp_day,portvol_ewma,vol_track_err_pp,orders_count_btc,orders_count_eth,min_trade_usd,L_max,asset_cap,slip_cap_bps,latency_ms,status,err_reason`

## Adapter swap
- Mock works offline. HypeRPCAdapter uses `urllib.request` and ENV (`HYPE_RPC_URL`, `HYPE_API_KEY`). Methods raise with a clear message if ENV/HTTP not available.

## KPIs
- delta_residual, funding_residual_bp_day, portvol_ewma(%), vol_track_err_pp(%)

This project is designed for clarity and easy extension to real RPC/Hyperliquid integration.
