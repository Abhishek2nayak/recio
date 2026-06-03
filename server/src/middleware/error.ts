/**
 * Central error handling. `asyncHandler` funnels rejected promises here; this
 * middleware maps HttpError / ZodError / unknown into the structured envelope.
 */
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { ErrorCode, fail } from "@flowcap/shared";
import { HttpError } from "../lib/http-error.js";
import { isProd } from "../config/env.js";

/** Wrap an async route so thrown/rejected errors reach the error middleware. */
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(fail(ErrorCode.NOT_FOUND, "Route not found."));
};

// Express identifies error middleware by its 4-arg signature, so `next` must stay.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof HttpError) {
    res.status(err.status).json(fail(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of err.issues) details[issue.path.join(".") || "_"] = issue.message;
    res.status(422).json(fail(ErrorCode.VALIDATION_ERROR, "Validation failed.", details));
    return;
  }

  // Unknown / unexpected.
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.error("Unhandled error:", err);
  }
  const message = !isProd && err instanceof Error ? err.message : undefined;
  res.status(500).json(fail(ErrorCode.INTERNAL_ERROR, message));
};
