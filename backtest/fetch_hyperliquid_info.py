"""
Fetch BTC/ETH 30m candles from Hyperliquid Info Server (REST) and write CSV.

Endpoint: https://api.hyperliquid.xyz/info (public Info Server)
Request (typical): POST JSON {"type":"candleSnapshot","coin":"BTC","interval":"30m"}

Notes
- Some deployments return arrays of arrays: [t, o, h, l, c, v]
- Others may return list of dicts with keys like {"t":..., "c":...}
- This script handles both and writes timestamp,symbol,close
"""
import argparse
import csv
import json
import os
import sys
from typing import List, Tuple

import requests


def fetch_candle_snapshot(base_url: str, coin: str, interval: str, req_type: str = 'candleSnapshot', coin_key: str = 'coin', interval_key: str = 'interval', start_ms: int | None = None, end_ms: int | None = None, n: int | None = None) -> List[Tuple[int, float]]:
    url = base_url.rstrip('/')
    headers = {"content-type": "application/json"}
    # Prefer req-wrapped shape; many deployments expect this for candles
    req: dict = {coin_key: coin, interval_key: interval}
    if start_ms is not None and end_ms is not None:
        req.update({"startTime": int(start_ms), "endTime": int(end_ms)})
    elif n is not None:
        req.update({"n": int(n)})
    payload = {"type": req_type, "req": req}
    r = requests.post(url, headers=headers, data=json.dumps(payload), timeout=30)
    r.raise_for_status()
    # Expect JSON; try to parse flexible shapes, including stringified JSON
    try:
        j = r.json()
    except Exception as e:
        # Some deployments return text/plain but with JSON content; try r.text
        try:
            j = json.loads(r.text)
        except Exception:
            raise RuntimeError(f"Non-JSON response from {url}: {e}; body starts with: {r.text[:120]!r}")

    # Common shapes: {'data': [[t,o,h,l,c,v], ...]} or {'data':[{'t':..,'c':..}, ...]} or top-level list
    data = None
    if isinstance(j, str):
        # Top-level is a JSON string of an array
        try:
            parsed = json.loads(j)
            if isinstance(parsed, list):
                data = parsed
        except Exception:
            pass
    if data is None and isinstance(j, dict):
        # Some servers nest deeper; try typical keys
        for key in ('data', 'result', 'candles', 'ohlcv', 'rows', 'value'):
            if key in j and isinstance(j[key], list):
                data = j[key]
                break
        if data is None and isinstance(j.get('details', {}).get('data'), list):
            data = j['details']['data']
    elif isinstance(j, list):
        data = j

    if not data:
        # Last resort: dump keys to help user debug
        raise RuntimeError(f"Unexpected response shape. Top-level keys: {list(j.keys()) if isinstance(j, dict) else type(j)}")

    out: List[Tuple[int, float]] = []
    for row in data:
        if isinstance(row, (list, tuple)):
            # [t, o, h, l, c, v] (assume seconds)
            ts = int(row[0])
            # convert ms->s if needed
            if ts > 10**12:
                ts = ts // 1000
            close = float(row[4])
            out.append((ts, close))
        elif isinstance(row, dict):
            tval = row.get('t') or row.get('timestamp') or row.get('ts')
            if tval is None:
                continue
            ts = int(tval)
            if ts > 10**12:
                ts = ts // 1000
            cval = row.get('c') or row.get('close')
            if cval is None:
                continue
            close = float(cval)
            out.append((ts, close))
    # Deduplicate/sort
    out = sorted({(ts, close) for ts, close in out}, key=lambda x: x[0])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base_url', default='https://api.hyperliquid.xyz/info')
    ap.add_argument('--symbols', default='BTC,ETH')
    ap.add_argument('--interval', default='30m')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), 'data', 'prices.csv'))
    ap.add_argument('--type', default='candleSnapshot')
    ap.add_argument('--coin_key', default='coin')
    ap.add_argument('--interval_key', default='interval')
    ap.add_argument('--start_ms', type=int, default=None)
    ap.add_argument('--end_ms', type=int, default=None)
    ap.add_argument('--n', type=int, default=None)
    args = ap.parse_args()

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, 'w', newline='') as f:
        csv.writer(f).writerow(['timestamp', 'symbol', 'close'])

    for sym in [s.strip() for s in args.symbols.split(',') if s.strip()]:
        try:
            rows = fetch_candle_snapshot(
                args.base_url, sym, args.interval,
                req_type=args.type, coin_key=args.coin_key, interval_key=args.interval_key,
                start_ms=args.start_ms, end_ms=args.end_ms, n=args.n
            )
        except Exception as e:
            print(f"Failed to fetch {sym}: {e}", file=sys.stderr)
            continue
        with open(args.out, 'a', newline='') as f:
            w = csv.writer(f)
            for ts, close in rows:
                w.writerow([ts, sym, close])
        print(f"Wrote {len(rows)} rows for {sym}")
    print('CSV written to', args.out)


if __name__ == '__main__':
    main()
