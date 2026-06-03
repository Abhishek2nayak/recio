/**
 * Structured error codes. Every API failure responds with
 * `{ success: false, error: { code, message } }` (see `types/api.ts`).
 *
 * Codes are stable, machine-readable strings the clients can switch on; messages
 * are human-readable defaults the server may override with specifics.
 */
export const ErrorCode = {
  // ── Auth ──
  UNAUTHENTICATED: "UNAUTHENTICATED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_INVALID: "TOKEN_INVALID",
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  FORBIDDEN: "FORBIDDEN",

  // ── Validation ──
  VALIDATION_ERROR: "VALIDATION_ERROR",

  // ── Resources ──
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_GONE: "RESOURCE_GONE",

  // ── Storage / Drive ──
  STORAGE_NOT_CONNECTED: "STORAGE_NOT_CONNECTED",
  DRIVE_AUTH_FAILED: "DRIVE_AUTH_FAILED",
  DRIVE_API_ERROR: "DRIVE_API_ERROR",
  UPLOAD_FAILED: "UPLOAD_FAILED",

  // ── Plan / limits ──
  PLAN_LIMIT_REACHED: "PLAN_LIMIT_REACHED",
  RATE_LIMITED: "RATE_LIMITED",

  // ── Generic ──
  BAD_REQUEST: "BAD_REQUEST",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Default human-readable message for each code. */
export const ErrorMessage: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "You must be signed in to do that.",
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  TOKEN_EXPIRED: "Your session has expired. Please sign in again.",
  TOKEN_INVALID: "Invalid authentication token.",
  EMAIL_ALREADY_EXISTS: "An account with this email already exists.",
  FORBIDDEN: "You don't have permission to do that.",
  VALIDATION_ERROR: "The request was invalid.",
  NOT_FOUND: "The requested resource was not found.",
  RESOURCE_GONE: "This resource is no longer available.",
  STORAGE_NOT_CONNECTED: "No storage provider is connected.",
  DRIVE_AUTH_FAILED: "Could not authenticate with Google Drive.",
  DRIVE_API_ERROR: "Google Drive returned an error.",
  UPLOAD_FAILED: "The upload failed. Please try again.",
  PLAN_LIMIT_REACHED: "You've reached your plan's limit.",
  RATE_LIMITED: "Too many requests. Please slow down.",
  BAD_REQUEST: "The request could not be processed.",
  INTERNAL_ERROR: "Something went wrong on our end.",
};

/** Suggested HTTP status for each code (the server is free to override). */
export const ErrorStatus: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  EMAIL_ALREADY_EXISTS: 409,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  RESOURCE_GONE: 410,
  STORAGE_NOT_CONNECTED: 400,
  DRIVE_AUTH_FAILED: 401,
  DRIVE_API_ERROR: 502,
  UPLOAD_FAILED: 500,
  PLAN_LIMIT_REACHED: 403,
  RATE_LIMITED: 429,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
};
