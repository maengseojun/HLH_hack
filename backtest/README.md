Backtest (B-option + Guards)

Overview
- Simulates the hourly rebalancer (B+Guards) on historical or synthetic prices.
- Applies the same guard order as production: per-symbol cap → net-delta centering → turnover cap scaling.

Inputs
- Prices CSV (long format): `timestamp,symbol,close` (+ optional funding)
  - Optional funding columns per row (choose one):
    - `funding_bps` or `funding_rate_bps` (per-period bps; positive means longs pay shorts)
    - `funding` or `fundingRate` (decimal fraction; e.g., 0.0001 = 1 bps)
  - Hourly or 30m cadence recommended; timestamps must be monotonic.
  - Symbols should include those in the strategy (e.g., BTC, ETH).
- Strategy JSON: same format as `HLH_hack/bots/strategy_*.json`.
- Config JSON: reads `HLH_hack/bots/config.json` for guard values and fee/slippage.

Outputs
- `reports/equity_curve.csv`: `timestamp,nav,gross_turnover_e6,fee_usd,funding_usd,note`.
- `reports/metrics.json`: summary stats (final NAV, total return, CAGR, Sharpe, MDD, turnover, total fees, funding PnL).
- Logs: stdout prints final NAV and key metrics.

Quick Start
1) Synthetic demo (no data needed):
   - `python run_synth.py --hours 240 --strategy ../bots/strategy_btc_eth.json`
2) CSV backtest:
   - Prepare `data/prices.csv` with columns: `timestamp,symbol,close` (hourly).
   - `python engine.py --prices data/prices.csv --strategy ../bots/strategy_btc_eth.json`

30m cadence
- Use 30-minute candles in the CSV and set cooldown to 1800 seconds:
  - `python engine.py --prices data/prices.csv --strategy ../bots/strategy_btc_eth.json --cooldown_seconds 1800`

Leverage and threshold
- Increase gross exposure: `--leverage 2` makes each bucket = 2×NAV (gross ≈ 4× NAV before caps/turnover guard).
- Reduce fee churn: `--rebalance_threshold_bps 50` skips rebalances if gross turnover < 0.50% of NAV at that step.

Notes
- PnL uses USD notional × simple return per step; all notionals are 1e6-scaled ints.
- Fees/slippage are bps knobs in config or CLI; defaults assume Hyperliquid taker 2 bps + 5 bps slippage.
- Funding defaults to 0 unless provided via CSV optional columns (see Inputs).

Parity with production logic
- Targeting and guards match `pure-bot.js` order and formulas:
  1) Per-symbol cap, 2) Net-delta centering, 3) Turnover cap proportional scaling, then reduceTo-equivalent fills.

Pair-neutral breakout strategy
- New strategy type: `type: "pair_neutral_breakout"` supports BTC/ETH (or any pair) delta-neutral base with breakout skew.
- JSON example: `../bots/strategy_pair_breakout_btc_eth.json`
- Params:
  - `lookback` (steps): window for log-spread z and optional beta (default 24)
  - `k_in`/`k_out`: enter/exit z thresholds (hysteresis), default 2.0/1.0
  - `minHoldSteps`: min steps to hold after entry (reduce churn)
  - `neutralDriftThresholdBps`: when neutral, skip rebal if gross turnover < this bps of NAV
  - `maxSkewBps`: max net tilt in bps of NAV on breakout (default 100 = 1%)
  - `betaMin`/`betaMax`: clamp for hedge ratio stability; `useBetaHedge` to enable
- Usage:
  - `python engine.py --prices data/prices_1h.csv --strategy ../bots/strategy_pair_breakout_btc_eth.json --cooldown_seconds 3600 --rebalance_threshold_bps 50`
