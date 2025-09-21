"""
Template fetcher for candles from a Hyperliquid/HyperPC-compatible HTTP API.

This script is a template because different deployments expose different paths
and JSON shapes. Fill in the endpoint and mapping in `fetch_candles()`.

Goal: produce a CSV `data/prices.csv` with columns: timestamp,symbol,close
at a 30-minute cadence for BTC and ETH.
"""
import csv
import time
from typing import List, Dict
import requests

def fetch_candles(base_url: str, symbol: str, interval: str, start_ts: int, end_ts: int) -> List[Dict]:
    """
    Replace the request/params and JSON parsing below to match your API.
    Expected return: list of dicts with keys: ts (unix seconds), close (float).
    """
    # Example placeholder: GET {base_url}/candles?symbol=BTC&interval=30m&start=...&end=...
    url = f"{base_url}/candles"
    params = {"symbol": symbol, "interval": interval, "start": start_ts, "end": end_ts}
    r = requests.get(url, params=params, timeout=30)
    r.raise_for_status()
    j = r.json()
    # Map from your JSON to [{"ts": int, "close": float}, ...]
    out = []
    for row in j.get('data', []):
        # adjust keys as needed
        ts = int(row.get('t') or row.get('timestamp'))
        close = float(row.get('c') or row.get('close'))
        out.append({"ts": ts, "close": close})
    return out

def write_prices_csv(rows: List[Dict], symbol: str, path: str):
    with open(path, 'a', newline='') as f:
        w = csv.writer(f)
        for r in rows:
            w.writerow([r['ts'], symbol, r['close']])

if __name__ == '__main__':
    import argparse, os
    parser = argparse.ArgumentParser()
    parser.add_argument('--base_url', required=True, help='e.g., https://hlh-builders-jp-testnet.hyperpc.app')
    parser.add_argument('--symbols', default='BTC,ETH')
    parser.add_argument('--interval', default='30m')
    parser.add_argument('--start', type=int, required=True, help='unix seconds')
    parser.add_argument('--end', type=int, required=True, help='unix seconds')
    parser.add_argument('--out', default=os.path.join(os.path.dirname(__file__), 'data', 'prices.csv'))
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    # write header
    with open(args.out, 'w', newline='') as f:
        csv.writer(f).writerow(['timestamp','symbol','close'])

    for sym in args.symbols.split(','):
        rows = fetch_candles(args.base_url, sym.strip(), args.interval, args.start, args.end)
        write_prices_csv(rows, sym.strip(), args.out)
    print('wrote', args.out)

