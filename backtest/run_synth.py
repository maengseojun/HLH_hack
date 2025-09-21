import json
import math
import os
import random
import time
from typing import List, Tuple

from engine import backtest, load_bots_config, load_strategy

def gen_synth(hours: int = 240, symbols = ("BTC","ETH"), seed: int = 42) -> List[Tuple[int,str,float]]:
    random.seed(seed)
    now = int(time.time())
    start = now - hours*3600
    prices = {s: 1000.0 if s=="BTC" else 100.0 for s in symbols}
    out = []
    for h in range(hours):
        ts = start + h*3600
        for s in symbols:
            # simple mean-reverting noise with different vol
            vol = 0.02 if s=="BTC" else 0.025
            r = random.gauss(0, vol)
            prices[s] *= (1.0 + r)
            out.append((ts, s, prices[s]))
    return out

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--hours', type=int, default=240)
    parser.add_argument('--strategy', type=str, default=os.path.join(os.path.dirname(__file__), '..', 'bots', 'strategy_btc_eth.json'))
    parser.add_argument('--config', type=str, default=os.path.join(os.path.dirname(__file__), '..', 'bots', 'config.json'))
    parser.add_argument('--start_nav', type=float, default=1_000_000.0)
    args = parser.parse_args()

    cfg = load_bots_config(args.config)
    strat = load_strategy(args.strategy)
    px = gen_synth(hours=args.hours)
    res = backtest(px, strat, cfg, start_nav_usd=args.start_nav)
    print(json.dumps(res, indent=2))

