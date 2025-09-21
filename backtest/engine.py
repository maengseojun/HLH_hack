import csv
import json
import math
import os
from collections import defaultdict, namedtuple
from dataclasses import dataclass
from typing import Dict, List, Tuple
import math as _math

E6 = 10**6

@dataclass
class Config:
    turnoverCapBps: int = 1000
    maxNetDeltaUSD: float = 50000
    perSymbolMaxUSD: Dict[str, float] = None
    cooldownSeconds: int = 3600
    feeBps: float = 5.0  # taker fee per rebalance adjustment (bps)
    slipBps: float = 10.0 # extra slippage model (bps)
    leverage: float = 1.0  # scales long/short buckets (gross leverage ~= 2*leverage of NAV)
    rebalanceThresholdBps: float = 0.0  # skip rebalances if gross turnover < threshold (bps of NAV)

    def __post_init__(self):
        if self.perSymbolMaxUSD is None:
            self.perSymbolMaxUSD = {"default": 250000}

def load_bots_config(path: str) -> Config:
    with open(path, 'r') as f:
        raw = json.load(f)
    return Config(
        turnoverCapBps=raw.get('turnoverCapBps', 1000),
        maxNetDeltaUSD=raw.get('maxNetDeltaUSD', 50000),
        perSymbolMaxUSD=raw.get('perSymbolMaxUSD', {"default": 250000}),
        cooldownSeconds=raw.get('cooldownSeconds', 3600),
        feeBps=raw.get('feeBps', 5.0),
        slipBps=raw.get('slipBps', 10.0),
        leverage=float(raw.get('leverage', 1.0)),
        rebalanceThresholdBps=float(raw.get('rebalanceThresholdBps', 0.0)),
    )

def load_strategy(path: str) -> Dict:
    with open(path, 'r') as f:
        s = json.load(f)
    # Backward-compatible: if no 'type', enforce fixed-bucket strategy format
    if 'type' not in s:
        def sum_bps(arr):
            return sum(int(x.get('bps', 0)) for x in arr)
        if sum_bps(s.get('longs', [])) != 10000 or sum_bps(s.get('shorts', [])) != 10000:
            raise ValueError('bps sum must be 10000 each for longs and shorts')
    return s

def clamp_target(sym: str, target: int, cfg: Config) -> int:
    cap_usd = cfg.perSymbolMaxUSD.get(sym, cfg.perSymbolMaxUSD.get('default', 250000))
    cap = int(cap_usd * E6)
    if target > cap:
        return cap
    if target < -cap:
        return -cap
    return target

def apply_guards(nav: int, current: Dict[str,int], targets: Dict[str,int], cfg: Config) -> Tuple[Dict[str,int], Dict[str,int]]:
    # 1) per-symbol cap
    for s in list(targets.keys()):
        targets[s] = clamp_target(s, targets[s], cfg)

    # 2) net delta guard (centering)
    intended = sum(targets.values())
    abs_intended = abs(intended)
    if abs_intended > int(cfg.maxNetDeltaUSD * E6):
        N = max(len(targets), 1)
        adj = intended // N
        for s in list(targets.keys()):
            targets[s] -= adj

    # 3) turnover cap (proportional scaling)
    deltas = {s: targets.get(s,0) - current.get(s,0) for s in targets.keys()}
    gross = sum(abs(v) for v in deltas.values())
    gmax = (nav * cfg.turnoverCapBps) // 10000
    scale_num, scale_den = (1,1)
    if gross > gmax and gross > 0:
        scale_num, scale_den = (gmax, gross)

    final = {}
    for s in targets.keys():
        scaled_delta = (deltas[s] * scale_num) // scale_den
        final[s] = current.get(s,0) + scaled_delta

    return targets, final


def guard_and_targets(nav: int, current: Dict[str,int], strat: Dict, cfg: Config) -> Tuple[Dict[str,int], Dict[str,int]]:
    # 1) raw targets from buckets
    long_bucket = int(nav * cfg.leverage)
    short_bucket = int(nav * cfg.leverage)
    targets: Dict[str,int] = defaultdict(int)
    for L in strat['longs']:
        targets[L['symbol']] += (long_bucket * int(L['bps'])) // 10000
    for S in strat['shorts']:
        targets[S['symbol']] -= (short_bucket * int(S['bps'])) // 10000
    return apply_guards(nav, current, targets, cfg)


def _safe_beta(ret_a: List[float], ret_b: List[float], beta_min: float, beta_max: float) -> float:
    if len(ret_a) != len(ret_b) or len(ret_a) < 2:
        return 1.0
    ma = sum(ret_a) / len(ret_a)
    mb = sum(ret_b) / len(ret_b)
    cov = sum((ra - ma) * (rb - mb) for ra, rb in zip(ret_a, ret_b)) / (len(ret_a) - 1)
    var_b = sum((rb - mb) ** 2 for rb in ret_b) / (len(ret_b) - 1)
    if var_b <= 0:
        return 1.0
    beta = cov / var_b
    if beta_min is not None:
        beta = max(beta, beta_min)
    if beta_max is not None:
        beta = min(beta, beta_max)
    if not _math.isfinite(beta):
        return 1.0
    return beta


def compute_targets_pair_breakout(nav: int, last_px: Dict[str,float], ret_hist: Dict[str,List[float]], symA: str, symB: str, params: Dict, cfg: Config, state: Dict, spread_hist: Dict) -> Tuple[Dict[str,int], Dict]:
    # params: lookback(int), z_k(float), maxSkewBps(float), betaMin(float), betaMax(float)
    lookback = int(params.get('lookback', 24))
    # Support legacy z_k as k_in
    k_in = float(params.get('k_in', params.get('z_k', 2.0)))
    k_out = float(params.get('k_out', max(1.0, k_in / 2.0)))
    min_hold = int(params.get('minHoldSteps', 0))
    neutral_skip_bps = float(params.get('neutralDriftThresholdBps', 0.0))
    regime_stop_bps = float(params.get('regimeStopBps', 50.0))
    regime_tp_bps = float(params.get('regimeTPBps', 100.0))
    max_skew_bps = float(params.get('maxSkewBps', 100.0))
    beta_min = float(params.get('betaMin', 0.2))
    beta_max = float(params.get('betaMax', 5.0))
    use_beta = bool(params.get('useBetaHedge', False))

    # require both prices
    if symA not in last_px or symB not in last_px:
        return {}, {"regime": state.get('regime', 'neutral'), "neutralSkipBps": neutral_skip_bps}

    # Hedge ratio using rolling beta of A on B
    ra = ret_hist.get(symA, [])[-lookback:]
    rb = ret_hist.get(symB, [])[-lookback:]
    beta = _safe_beta(ra, rb, beta_min, beta_max) if use_beta else 1.0

    # Base neutral gross (long A, short B) with ratio L/S = beta, preserving total gross ~ 2*nav*leverage
    total_gross_e6 = int(2 * nav * cfg.leverage)
    ratio = max(beta, 1e-6)
    s_usd_e6 = int(total_gross_e6 / (ratio + 1.0))
    l_usd_e6 = int(total_gross_e6 - s_usd_e6)

    # Spread z-score on log spread s = ln(A/B)
    try:
        s = _math.log(max(last_px[symA], 1e-12) / max(last_px[symB], 1e-12))
    except Exception:
        s = 0.0
    key = (symA, symB)
    hist = spread_hist.get(key, [])
    hist.append(s)
    spread_hist[key] = hist
    use_hist = hist[-lookback:]
    if len(use_hist) >= max(lookback // 2, 8):
        m = sum(use_hist) / len(use_hist)
        var = sum((x - m) ** 2 for x in use_hist) / max(1, len(use_hist) - 1)
        std = _math.sqrt(max(var, 0.0))
        z = (s - m) / std if std > 0 else 0.0
    else:
        z = 0.0

    # Skew: tilt net exposure when breakout detected
    # Regime logic with hysteresis and min-hold
    regime = state.get('regime', 'neutral')
    hold = int(state.get('hold', 0))
    entry_nav_e6 = int(state.get('entry_nav_e6', nav))
    new_regime = regime
    if regime == 'neutral':
        if k_in > 0 and z >= k_in:
            new_regime = 'long'
            hold = 0
            entry_nav_e6 = nav
        elif k_in > 0 and z <= -k_in:
            new_regime = 'short'
            hold = 0
            entry_nav_e6 = nav
    elif regime == 'long':
        # stop loss / take profit based on NAV change since entry
        if entry_nav_e6 > 0:
            nav_delta_bps = ((nav - entry_nav_e6) * 10000) // entry_nav_e6
            if regime_stop_bps > 0 and nav_delta_bps <= -regime_stop_bps:
                new_regime = 'neutral'
                hold = 0
            elif regime_tp_bps > 0 and nav_delta_bps >= regime_tp_bps:
                new_regime = 'neutral'
                hold = 0
        if hold < min_hold:
            hold += 1
        else:
            if abs(z) <= k_out:
                new_regime = 'neutral'
                hold = 0
            else:
                hold += 1
    elif regime == 'short':
        if entry_nav_e6 > 0:
            nav_delta_bps = ((nav - entry_nav_e6) * 10000) // entry_nav_e6
            if regime_stop_bps > 0 and nav_delta_bps <= -regime_stop_bps:
                new_regime = 'neutral'
                hold = 0
            elif regime_tp_bps > 0 and nav_delta_bps >= regime_tp_bps:
                new_regime = 'neutral'
                hold = 0
        if hold < min_hold:
            hold += 1
        else:
            if abs(z) <= k_out:
                new_regime = 'neutral'
                hold = 0
            else:
                hold += 1

    state['regime'] = new_regime
    state['hold'] = hold
    state['entry_nav_e6'] = entry_nav_e6

    skew = 0
    if new_regime in ('long', 'short') and k_in > 0 and abs(z) > k_in:
        scale = min((abs(z) - k_in) / max(k_in, 1e-9), 1.0)
        skew = int((nav * (max_skew_bps / 10000.0)) * scale * E6)
        if new_regime == 'short':
            skew = -skew

    # Apply skew by shifting long up and short down to create net tilt
    if skew != 0:
        delta = skew // 2
        l_usd_e6 = max(0, l_usd_e6 + delta)
        s_usd_e6 = max(0, s_usd_e6 - delta)

    targets = {symA: l_usd_e6, symB: -s_usd_e6}
    return targets, {"regime": new_regime, "neutralSkipBps": neutral_skip_bps}

def read_prices_csv(path: str) -> List[Tuple[int, str, float, float]]:
    """
    Reads a long-format CSV with required columns: timestamp,symbol,close
    Optional funding columns supported (choose one):
      - funding_bps: per-period funding in basis points (bps)
      - funding, fundingRate: decimal fraction (e.g., 0.0001 for 1 bps)

    Returns list of (timestamp, symbol, close, funding_bps)
    """
    out: List[Tuple[int, str, float, float]] = []
    with open(path, 'r', newline='') as f:
        r = csv.DictReader(f)
        # detect columns
        cols = [c.strip() for c in r.fieldnames or []]
        has_bps = 'funding_bps' in cols or 'funding_rate_bps' in cols
        has_decimal = ('funding' in cols) or ('fundingRate' in cols)
        for row in r:
            ts = int(row['timestamp'])
            sym = row['symbol']
            close = float(row['close'])
            f_bps = 0.0
            if has_bps:
                val = row.get('funding_bps') or row.get('funding_rate_bps')
                if val not in (None, ''):
                    try:
                        f_bps = float(val)
                    except Exception:
                        f_bps = 0.0
            elif has_decimal:
                val = row.get('funding')
                if val in (None, ''):
                    val = row.get('fundingRate')
                if val not in (None, ''):
                    try:
                        f_bps = float(val) * 10000.0
                    except Exception:
                        f_bps = 0.0
            out.append((ts, sym, close, f_bps))
    out.sort(key=lambda x: x[0])
    return out

def backtest(prices: List[Tuple[int, str, float, float]], strat: Dict, cfg: Config, start_nav_usd: float = 1_000_000.0):
    # state
    symbols = sorted(set(sym for _, sym, _, _ in prices))
    last_px: Dict[str,float] = {}
    pos: Dict[str,int] = {s:0 for s in symbols} # USD 1e6
    nav = int(start_nav_usd * E6)
    last_rebal_ts = None
    fee_bps = cfg.__dict__.get('feeBps', 5.0)
    slip_bps = cfg.__dict__.get('slipBps', 10.0)

    rows_by_ts: Dict[int, Dict[str, float]] = defaultdict(dict)
    funding_bps_by_ts: Dict[int, Dict[str, float]] = defaultdict(dict)
    for ts, sym, px, f_bps in prices:
        rows_by_ts[ts][sym] = px
        if f_bps != 0:
            funding_bps_by_ts[ts][sym] = f_bps
    timeline = sorted(rows_by_ts.keys())

    reports_dir = os.path.join(os.path.dirname(__file__), 'reports')
    os.makedirs(reports_dir, exist_ok=True)
    ec_path = os.path.join(reports_dir, 'equity_curve.csv')
    # return histories for pair strategies
    ret_hist: Dict[str, List[float]] = {s: [] for s in symbols}
    spread_hist: Dict[Tuple[str,str], List[float]] = {}
    pair_state: Dict = {'regime': 'neutral', 'hold': 0}

    with open(ec_path, 'w', newline='') as f_ec:
        w = csv.writer(f_ec)
        w.writerow(['timestamp','nav','gross_turnover_e6','fee_usd','funding_usd','note'])

        # for metrics
        nav_series: List[float] = []
        ts_series: List[int] = []
        total_fee_usd = 0.0
        total_funding_usd = 0.0
        total_gross_turnover_e6 = 0
        rebalances = 0
        rebalances_with_trades = 0

        for ts in timeline:
            row = rows_by_ts[ts]
            # 1) apply returns
            pnl = 0
            for s in symbols:
                if s in row and s in last_px:
                    ret = (row[s] / last_px[s]) - 1.0
                    pnl += int(pos.get(s,0) * ret)
                    ret_hist[s].append(ret)
            nav += pnl

            # update last prices
            for s in row:
                last_px[s] = row[s]

            note = ''
            gross_e6 = 0
            fee_usd = 0.0
            funding_usd = 0.0

            # 1.5) apply funding for the just-finished interval
            # Positive funding_bps means longs pay shorts.
            if ts in funding_bps_by_ts:
                for s, f_bps in funding_bps_by_ts[ts].items():
                    p = pos.get(s, 0)
                    if p != 0 and f_bps != 0:
                        funding_usd += -(p / E6) * (f_bps / 10000.0)
                nav += int(funding_usd * E6)
                total_funding_usd += funding_usd

            # 2) periodic rebalance based on cooldownSeconds
            if last_rebal_ts is None or (ts - last_rebal_ts) >= cfg.cooldownSeconds:
                # targets and guards
                meta_info = {}
                if strat.get('type') == 'pair_neutral_breakout':
                    syms = strat.get('symbols') or symbols
                    if len(syms) < 2:
                        targets = {}
                    else:
                        symA, symB = syms[0], syms[1]
                        params = strat.get('params', {})
                        raw_targets, meta_info = compute_targets_pair_breakout(nav, last_px, ret_hist, symA, symB, params, cfg, pair_state, spread_hist)
                        targets, final = apply_guards(nav, pos, raw_targets, cfg)
                else:
                    targets, final = guard_and_targets(nav, pos, strat, cfg)
                deltas = {s: final.get(s,0) - pos.get(s,0) for s in final.keys()}
                gross_e6 = sum(abs(v) for v in deltas.values())

                # extra neutral drift threshold for pair strategy
                if meta_info.get('regime') == 'neutral' and nav > 0:
                    nbps = float(meta_info.get('neutralSkipBps') or 0.0)
                    if nbps > 0:
                        gross_bps_neutral = (gross_e6 * 10000) // max(nav, 1)
                        if gross_bps_neutral < nbps:
                            note = 'skip_neutral_drift'
                            w.writerow([ts, nav / E6, gross_e6, f"{fee_usd:.2f}", f"{funding_usd:.2f}", note])
                            nav_series.append(nav / E6)
                            ts_series.append(ts)
                            continue

                # optional threshold: skip tiny rebalances (reduce fee churn)
                if cfg.rebalanceThresholdBps > 0 and nav > 0:
                    gross_bps = (gross_e6 * 10000) // max(nav, 1)
                    if gross_bps < cfg.rebalanceThresholdBps:
                        # do not update positions or last_rebal_ts; just mark note and continue
                        note = 'skip_threshold'
                        w.writerow([ts, nav / E6, gross_e6, f"{fee_usd:.2f}", f"{funding_usd:.2f}", note])
                        nav_series.append(nav / E6)
                        ts_series.append(ts)
                        continue

                # fees/slippage on turnover
                costs_bps = (fee_bps + slip_bps) / 10000.0
                fee_usd = (gross_e6 / E6) * costs_bps

                # apply fills
                pos.update(final)
                nav -= int(fee_usd * E6)
                last_rebal_ts = ts
                note = 'rebalance'
                rebalances += 1
                if gross_e6 > 0:
                    rebalances_with_trades += 1
                total_gross_turnover_e6 += gross_e6
                total_fee_usd += fee_usd

            w.writerow([ts, nav / E6, gross_e6, f"{fee_usd:.2f}", f"{funding_usd:.2f}", note])
            nav_series.append(nav / E6)
            ts_series.append(ts)

    # summary metrics
    def compute_metrics(nav_series: List[float], ts_series: List[int]):
        res: Dict[str, float] = {}
        if len(nav_series) < 2:
            return res
        start_nav = nav_series[0]
        end_nav = nav_series[-1]
        total_return = (end_nav / start_nav) - 1.0 if start_nav > 0 else 0.0
        duration_sec = max(1, ts_series[-1] - ts_series[0])
        year_sec = 365 * 24 * 3600
        cagr = (end_nav / start_nav) ** (year_sec / duration_sec) - 1.0 if start_nav > 0 else 0.0
        # step stats
        step_rets: List[float] = []
        for i in range(1, len(nav_series)):
            prev = nav_series[i-1]
            cur = nav_series[i]
            if prev > 0:
                step_rets.append((cur / prev) - 1.0)
        # cadence -> steps per year
        if len(ts_series) >= 2:
            deltas = [ts_series[i]-ts_series[i-1] for i in range(1, len(ts_series)) if ts_series[i]>ts_series[i-1]]
            if len(deltas) > 0:
                avg_dt = sum(deltas) / len(deltas)
            else:
                avg_dt = 3600.0
        else:
            avg_dt = 3600.0
        steps_per_year = year_sec / max(1.0, avg_dt)
        # sharpe (rf=0)
        import math as _math
        if len(step_rets) >= 2:
            m = sum(step_rets) / len(step_rets)
            var = sum((x - m) ** 2 for x in step_rets) / (len(step_rets) - 1)
            std = _math.sqrt(max(var, 0.0))
            sharpe = (m / std) * (_math.sqrt(steps_per_year)) if std > 0 else 0.0
        else:
            sharpe = 0.0
        # max drawdown
        peak = nav_series[0]
        mdd = 0.0
        for v in nav_series:
            if v > peak:
                peak = v
            dd = (v / peak) - 1.0
            if dd < mdd:
                mdd = dd
        res.update({
            'start_nav_usd': start_nav,
            'final_nav_usd': end_nav,
            'total_return': total_return,
            'cagr': cagr,
            'sharpe': sharpe,
            'max_drawdown': mdd,
            'steps': len(nav_series),
            'duration_days': duration_sec / 86400.0,
            'rebalances': rebalances,
            'rebalances_with_trades': rebalances_with_trades,
            'total_turnover_usd': total_gross_turnover_e6 / E6,
            'total_fee_paid_usd': total_fee_usd,
            'total_funding_pnl_usd': total_funding_usd,
        })
        return res

    metrics = compute_metrics(nav_series, ts_series)
    # Write metrics.json
    reports_dir = os.path.join(os.path.dirname(__file__), 'reports')
    os.makedirs(reports_dir, exist_ok=True)
    with open(os.path.join(reports_dir, 'metrics.json'), 'w') as f_m:
        json.dump(metrics, f_m, indent=2)

    # Return key results in stdout
    out = {'final_nav_usd': nav / E6}
    out.update({k: metrics.get(k) for k in (
        'total_return','cagr','sharpe','max_drawdown','total_fee_paid_usd','total_funding_pnl_usd'
    )})
    return out

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--prices', type=str, required=True)
    parser.add_argument('--strategy', type=str, required=True)
    parser.add_argument('--config', type=str, default=os.path.join(os.path.dirname(__file__), '..', 'bots', 'config.json'))
    parser.add_argument('--start_nav', type=float, default=1_000_000.0)
    parser.add_argument('--cooldown_seconds', type=int, default=None, help='Override cooldownSeconds for cadence (e.g., 1800 for 30m)')
    parser.add_argument('--fee_bps', type=float, default=None, help='Override taker fee bps')
    parser.add_argument('--slip_bps', type=float, default=None, help='Override slippage bps')
    parser.add_argument('--leverage', type=float, default=None, help='Gross leverage multiplier for long/short buckets (default 1.0 -> gross ~2x NAV)')
    parser.add_argument('--rebalance_threshold_bps', type=float, default=None, help='Skip rebalances if gross turnover < threshold (bps of NAV)')
    args = parser.parse_args()

    cfg = load_bots_config(args.config)
    if args.cooldown_seconds is not None:
        cfg.cooldownSeconds = args.cooldown_seconds
    if args.fee_bps is not None:
        cfg.feeBps = args.fee_bps
    if args.slip_bps is not None:
        cfg.slipBps = args.slip_bps
    if args.leverage is not None:
        cfg.leverage = args.leverage
    if args.rebalance_threshold_bps is not None:
        cfg.rebalanceThresholdBps = args.rebalance_threshold_bps
    strat = load_strategy(args.strategy)
    px = read_prices_csv(args.prices)
    res = backtest(px, strat, cfg, start_nav_usd=args.start_nav)
    print(json.dumps(res, indent=2))
