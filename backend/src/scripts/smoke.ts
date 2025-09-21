import process from 'node:process';

type SmokeCase = {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
};

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000/v1';

const cases: SmokeCase[] = [
  {
    name: 'BTC 7d candles',
    method: 'GET',
    path: '/assets/BTC-PERP/candles?interval=7d',
  },
  {
    name: 'BTC 1h candles',
    method: 'GET',
    path: '/assets/BTC-PERP/candles?interval=1h',
  },
  {
    name: 'Basket 7d preset',
    method: 'POST',
    path: '/baskets/calculate',
    body: {
      assets: [
        { symbol: 'BTC-PERP', weight: 0.5, position: 'long', leverage: 2 },
        { symbol: 'ETH-PERP', weight: 0.5, position: 'long', leverage: 2 },
      ],
      interval: '7d',
    },
  },
  {
    name: 'Basket 30d preset',
    method: 'POST',
    path: '/baskets/calculate',
    body: {
      assets: [
        { symbol: 'BTC-PERP', weight: 0.4, position: 'long', leverage: 3 },
        { symbol: 'ETH-PERP', weight: 0.6, position: 'short', leverage: 2 },
      ],
      interval: '1d',
    },
  },
];

async function runCase(smokeCase: SmokeCase): Promise<void> {
  const url = `${BASE_URL}${smokeCase.path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      method: smokeCase.method,
      headers: smokeCase.method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: smokeCase.body ? JSON.stringify(smokeCase.body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const payload = await response.json();

    if (smokeCase.method === 'GET') {
      if (!Array.isArray(payload?.candles) || payload.candles.length === 0) {
        throw new Error('Expected non-empty candles array');
      }
    }

    if (smokeCase.method === 'POST') {
      if (!Array.isArray(payload?.basketPriceHistory) || payload.basketPriceHistory.length === 0) {
        throw new Error('Expected non-empty basketPriceHistory array');
      }
    }

    console.log(`✔ ${smokeCase.name}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  const results = await Promise.allSettled(cases.map((c) => runCase(c)));

  const failures = results
    .map((result, index) => ({ result, index }))
    .filter((item): item is { result: PromiseRejectedResult; index: number } => item.result.status === 'rejected')
    .map(({ result, index }) => ({ case: cases[index], error: result.reason as Error }));

  if (failures.length > 0) {
    console.error('Smoke test failures detected:');
    for (const failure of failures) {
      console.error(`- ${failure.case.name}: ${failure.error.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`All ${cases.length} smoke checks passed against ${BASE_URL}`);
}

main().catch((error) => {
  console.error('Smoke test runner failed:', error);
  process.exitCode = 1;
});
