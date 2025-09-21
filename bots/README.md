Back Rebalance Bot (B option + Guards)

What it does
- Reads NAV and current positions via `IHLCoreReader`.
- Computes targets from a strategy JSON (gross 200%: 100% long bucket + 100% short bucket).
- Applies risk guards (turnover cap, per-symbol cap, net delta, cooldown).
- Calls `IHLCoreWriter.reduceTo(symbol, target, slipBps, ttlSeconds)`.


Files
- `pure-bot.js`: main bot (Node.js).
- `strategy_eth_vs_l2.json`: example strategy from ggg.md.
- `IHLCoreReader.json`, `IHLCoreWriter.json`: minimal ABIs.
- `.env.example`: required envs.
- `config.json`: production guard values (hourly cadence).

Setup
1) Create `.env` from example and fill values:
   - `RPC_URL`, `PRIVATE_KEY`, `READER_ADDR`, `WRITER_ADDR`
   - Optional: `INTERVAL_SECONDS` (default 3600), `SLIP_BPS` (30), `TTL_SECONDS` (60)
2) Install deps in this folder:
   - `npm i ethers dotenv`

Run
- One-off dry-run: `node pure-bot.js --strategy strategy_eth_vs_l2.json --once --dry-run`
- Continuous (hourly by default): `node pure-bot.js --strategy strategy_eth_vs_l2.json`

Config knobs (`config.json`)
- `turnoverCapBps`: Max sum of absolute adjustments per run (bps of NAV).
- `perSymbolMaxUSD.default`: Per-symbol notional cap in USD.
- `maxNetDeltaUSD`: Absolute net exposure guard after actions.
- `cooldownSeconds`: Minimum seconds between runs.
- `maxRetries` / `retryBackoffMs`: Order retry policy.
- `dryRun`: If true, logs only, no on-chain calls.

Notes
- All notionals are 1e6-scaled USD integers, following ggg.md.
- Strategy JSON bps must sum to 10,000 for longs and 10,000 for shorts.
