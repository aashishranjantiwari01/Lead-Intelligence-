import type { ApiSuccess, ApiError } from '@lie/shared';
import type { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const body: ApiSuccess<T> = { success: true, data };
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: unknown
): void {
  const body: ApiError = {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
  res.status(statusCode).json(body);
}
