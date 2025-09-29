import { AppError } from './httpError.js';

export type CandleInterval = '5m' | '1h' | '1d' | '7d';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type PresetConfig = {
  durationMs: number;
  allowedDurationsMs: readonly number[];
};

const CANDLE_PRESETS: Record<CandleInterval, PresetConfig> = {
  '5m': {
    durationMs: DAY_MS, // 1 day of 5-minute candles
    allowedDurationsMs: [DAY_MS],
  },
  '1h': {
    durationMs: 7 * DAY_MS, // 1 week of 1-hour candles
    allowedDurationsMs: [7 * DAY_MS],
  },
  '1d': {
    durationMs: 30 * DAY_MS, // 30 days of 1-day candles
    allowedDurationsMs: [30 * DAY_MS],
  },
  '7d': {
    durationMs: 7 * DAY_MS, // 7 days of 1-day candles grouped weekly
    allowedDurationsMs: [7 * DAY_MS],
  },
};

const RANGE_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes tolerance for user-supplied timestamps.

type RangeInput = {
  interval: CandleInterval;
  from?: number;
  to?: number;
  now?: number;
};

export type ResolvedPresetRange = {
  from: number;
  to: number;
  durationMs: number;
  presetDurationMs: number;
  preset: PresetConfig;
};

export function resolvePresetRange({ interval, from, to, now = Date.now() }: RangeInput): ResolvedPresetRange {
  const preset = CANDLE_PRESETS[interval];
  if (!preset) {
    throw new AppError(400, {
      code: 'UNSUPPORTED_PRESET',
      message: `Interval '${interval}' is not supported. Allowed: ${Object.keys(CANDLE_PRESETS).join(', ')}`,
    });
  }

  const end = to ?? now;
  const start = from ?? end - preset.durationMs;

  if (start >= end) {
    throw new AppError(400, {
      code: 'INVALID_RANGE',
      message: '`from` must be earlier than `to`',
      details: { from: start, to: end },
    });
  }

  const duration = end - start;
  const withinAllowed = preset.allowedDurationsMs.some((allowed) => Math.abs(duration - allowed) <= RANGE_TOLERANCE_MS);

  if (!withinAllowed) {
    const maxAllowed = Math.max(...preset.allowedDurationsMs);
    if (duration > maxAllowed + RANGE_TOLERANCE_MS) {
      throw new AppError(400, {
        code: 'LOOKBACK_EXCEEDED',
        message: 'Max lookback exceeded for requested interval (Hyperliquid exposes only the latest 5000 candles)',
        details: {
          requestedDurationMs: duration,
          maxDurationMs: maxAllowed,
          upstreamLimitCandles: 5000,
        },
      });
    }

    throw new AppError(400, {
      code: 'INVALID_RANGE',
      message: `Range ${duration}ms is not supported for interval '${interval}'.`,
      details: {
        requestedDurationMs: duration,
        allowedDurationsMs: preset.allowedDurationsMs,
      },
    });
  }

  return {
    from: start,
    to: end,
    durationMs: duration,
    presetDurationMs: preset.durationMs,
    preset,
  };
}

export function listCandlePresets(): Record<CandleInterval, PresetConfig> {
  return { ...CANDLE_PRESETS };
}
