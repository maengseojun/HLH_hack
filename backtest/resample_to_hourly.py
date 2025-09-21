import csv
import os
import argparse
from collections import defaultdict


def resample_to_hourly(in_csv: str, out_csv: str):
    rows_by_sym_hour = defaultdict(dict)  # sym -> hour_ts -> (ts, close)
    with open(in_csv, 'r', newline='') as f:
        r = csv.DictReader(f)
        for row in r:
            ts = int(row['timestamp'])
            sym = row['symbol']
            close = float(row['close'])
            hour_ts = (ts // 3600) * 3600
            # keep the last record within the hour (closest to next hour)
            prev = rows_by_sym_hour[sym].get(hour_ts)
            if prev is None or ts >= prev[0]:
                rows_by_sym_hour[sym][hour_ts] = (ts, close)

    # flatten and sort by timestamp
    out_rows = []
    for sym, by_hour in rows_by_sym_hour.items():
        for hour_ts, (ts, close) in by_hour.items():
            out_rows.append((hour_ts, sym, close))
    out_rows.sort(key=lambda x: (x[0], x[1]))

    os.makedirs(os.path.dirname(out_csv), exist_ok=True)
    with open(out_csv, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['timestamp', 'symbol', 'close'])
        for ts, sym, close in out_rows:
            w.writerow([ts, sym, close])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='in_csv', default=os.path.join(os.path.dirname(__file__), 'data', 'prices.csv'))
    ap.add_argument('--out', dest='out_csv', default=os.path.join(os.path.dirname(__file__), 'data', 'prices_1h.csv'))
    args = ap.parse_args()
    resample_to_hourly(args.in_csv, args.out_csv)
    print('Wrote hourly CSV to', args.out_csv)


if __name__ == '__main__':
    main()

