export interface AppErrorPayload {
  code: string;
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
