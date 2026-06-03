/**
 * The API envelope: every response is a discriminated union on `success`, and every
 * error carries a stable `code` from `ErrorCode`. Clients narrow on `success`.
 */
import type { ErrorCode } from "../constants/errors.js";

export interface ApiError {
  code: ErrorCode;
  message: string;
  /** Optional per-field validation details (field path → message). */
  details?: Record<string, string>;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/**
 * Cursor-based pagination envelope for list endpoints. `nextCursor` is an opaque
 * token (null when there are no more pages).
 */
export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PaginationQuery {
  cursor?: string;
  limit?: number;
}
