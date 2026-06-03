/**
 * Tiny helpers for constructing the API envelope. Shared so the server builds
 * responses and the clients can build typed mocks/fixtures the same way.
 */
import { ErrorCode, ErrorMessage } from "../constants/errors.js";
import type { ApiFailure, ApiSuccess } from "../types/api.js";

export function ok<T>(data: T): ApiSuccess<T> {
  return { success: true, data };
}

export function fail(
  code: ErrorCode,
  message?: string,
  details?: Record<string, string>,
): ApiFailure {
  return {
    success: false,
    error: {
      code,
      message: message ?? ErrorMessage[code],
      ...(details ? { details } : {}),
    },
  };
}
