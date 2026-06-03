/**
 * HttpError — throw this anywhere in a handler/service and the central error
 * middleware turns it into the structured `{ success:false, error:{code,message} }`
 * envelope with the right status. Keeps routes free of response-shaping noise.
 */
import { ErrorCode, ErrorMessage, ErrorStatus } from "@flowcap/shared";

export class HttpError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, string>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, string>) {
    super(message ?? ErrorMessage[code]);
    this.name = "HttpError";
    this.code = code;
    this.status = ErrorStatus[code];
    if (details) this.details = details;
  }

  static unauthenticated(message?: string): HttpError {
    return new HttpError(ErrorCode.UNAUTHENTICATED, message);
  }
  static notFound(message?: string): HttpError {
    return new HttpError(ErrorCode.NOT_FOUND, message);
  }
  static forbidden(message?: string): HttpError {
    return new HttpError(ErrorCode.FORBIDDEN, message);
  }
  static badRequest(message?: string): HttpError {
    return new HttpError(ErrorCode.BAD_REQUEST, message);
  }
}
