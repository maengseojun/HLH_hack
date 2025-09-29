export interface AppErrorPayload {
  code:
    | 'BAD_REQUEST'
    | 'INVALID_RANGE'
    | 'LOOKBACK_EXCEEDED'
    | 'UNSUPPORTED_PRESET'
    | 'UNSUPPORTED_SYMBOL'
    | 'ASSET_NOT_FOUND'
    | 'WEIGHT_SUM_INVALID'
    | 'EMPTY_CANDLES'
    | 'UPSTREAM_UNAVAILABLE'
    | 'INSUFFICIENT_FUNDS'
    | 'INSUFFICIENT_POSITION'
    | 'SIZE_TOO_SMALL'
    | 'LEVERAGE_EXCEEDED'
    | 'PX_BAND_EXCEEDED'
    | 'PRECOMPILE_PARSE_ERROR'
    | 'WALLET_NOT_REGISTERED'
    | 'ONCHAIN_REVERT'
    | 'UNAUTHORIZED'
    | 'AUTH_MODE_NOT_IMPLEMENTED'
    | 'AUTH_MISCONFIGURATION'
    | 'AUTH_ERROR'
    | 'IDEMP_IN_PROGRESS';
  message: string;
  details?: unknown;
  retryAfterSec?: number;
}

export class AppError extends Error {
  status: number;
  payload: AppErrorPayload;

  constructor(status: number, payload: AppErrorPayload) {
    super(payload.message);
    this.status = status;
    this.payload = payload;
  }
}

export const errorBody = (payload: AppErrorPayload) => ({ error: payload });
