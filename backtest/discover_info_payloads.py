"""
Brute-force probe of Hyperliquid Info Server payload shapes for candles.

Tries combinations of:
- type: candleSnapshot, candle
- symbol key: coin, asset, symbol
- interval key: interval, tf, resolution
- interval values: 30m, 1800, 30min

Prints the first working combo and sample keys.
"""
import argparse
import json
import itertools
import requests

TYPES = ["candleSnapshot", "candle"]
SYM_KEYS = ["coin", "asset", "symbol"]
INT_KEYS = ["interval", "tf", "resolution"]
INT_VALS = ["30m", 1800, "30min"]

def try_one(base, t, sk, ik, iv, sym):
    url = base.rstrip('/')
    payload = {"type": t, sk: sym, ik: iv}
    r = requests.post(url, headers={"content-type":"application/json"}, json=payload, timeout=10)
    ct = r.headers.get('content-type','')
    print(f"{t} {sk}={sym} {ik}={iv} -> {r.status_code} {ct}")
    if r.status_code != 200 or 'json' not in ct:
        return False
    try:
        j = r.json()
    except Exception:
        return False
    for key in ('data','result','candles','ohlcv','rows'):
        if isinstance(j.get(key), list) and j[key]:
            first = j[key][0]
            print('Found list at', key, 'sample:', first if isinstance(first, dict) else type(first))
            return True
    print('Top-level keys:', list(j.keys()) if isinstance(j, dict) else type(j))
    return False

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--base_url', default='https://api.hyperliquid.xyz/info')
    ap.add_argument('--symbol', default='BTC')
    args = ap.parse_args()
    for t, sk, ik, iv in itertools.product(TYPES, SYM_KEYS, INT_KEYS, INT_VALS):
        ok = try_one(args.base_url, t, sk, ik, iv, args.symbol)
        if ok:
            print('SUCCESS:', t, sk, ik, iv)
            break

