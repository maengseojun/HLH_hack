"""
Endpoint discovery helper for HyperPC/Hyperliquid-style APIs.

It probes a set of common REST paths and parameter shapes to infer the
available candles endpoint and response schema. Then you can plug the
found mapping into `fetch_hyperpc_template.py`.

Usage (example):
  python discover_hyperpc.py --base_url https://hlh-builders-jp-testnet.hyperpc.app --symbol BTC --interval 30m --start <unix> --end <unix>

Note: This script assumes public endpoints. If your deployment requires auth,
add headers/tokens as needed.
"""
import argparse
import json
import time
from typing import Dict, List, Tuple
import requests

candidate_paths = [
    "/candles",
    "/api/candles",
    "/api/v1/candles",
    "/ohlcv",
    "/api/ohlcv",
    "/api/v1/ohlcv",
]

candidate_param_sets = [
    lambda s,i,a,b: {"symbol": s, "interval": i, "start": a, "end": b},
    lambda s,i,a,b: {"symbol": s, "tf": i, "start": a, "end": b},
    lambda s,i,a,b: {"symbol": s, "resolution": i, "from": a, "to": b},
    lambda s,i,a,b: {"symbol": s, "interval": i, "limit": 1000},
]

def probe(base: str, symbol: str, interval: str, start: int, end: int) -> None:
    headers = {"Accept": "application/json"}
    for path in candidate_paths:
        for mk in candidate_param_sets:
            url = base.rstrip('/') + path
            params = mk(symbol, interval, start, end)
            try:
                r = requests.get(url, params=params, headers=headers, timeout=10)
                status = r.status_code
                ctype = r.headers.get('Content-Type','')
                print(f"GET {url} {params} -> {status} {ctype}")
                if status == 200 and 'json' in ctype:
                    j = r.json()
                    print('Top-level keys:', list(j.keys())[:10])
                    # Try common locations for array data
                    for key in ('data','result','candles','ohlcv','rows'):
                        if isinstance(j.get(key), list) and j[key]:
                            first = j[key][0]
                            print(f"Sample element keys in '{key}':", list(first.keys())[:10] if isinstance(first, dict) else type(first))
                    print('-'*60)
            except Exception as e:
                print(f"Error {url} {params}: {e}")

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--base_url', required=True)
    ap.add_argument('--symbol', default='BTC')
    ap.add_argument('--interval', default='30m')
    ap.add_argument('--start', type=int, required=True)
    ap.add_argument('--end', type=int, required=True)
    args = ap.parse_args()
    probe(args.base_url, args.symbol, args.interval, args.start, args.end)

