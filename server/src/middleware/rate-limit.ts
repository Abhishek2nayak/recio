/**
 * Rate limiters. A general limiter guards all API routes; a stricter one guards
 * auth endpoints (login/register) against credential stuffing. Both emit the
 * structured error envelope on trip.
 */
import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { ErrorCode, fail } from "@flowcap/shared";

function tripHandler(_req: Request, res: Response): void {
  res.status(429).json(fail(ErrorCode.RATE_LIMITED, "Too many requests. Please slow down."));
}

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120, // per IP per minute
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: tripHandler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20, // per IP per 15 min
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: tripHandler,
});
