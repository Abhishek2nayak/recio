/**
 * `requireAuth` verifies the Bearer access token and attaches `req.userId`.
 * Distinguishes "expired" (→ client should refresh) from "invalid" (→ re-login).
 */
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { ErrorCode } from "@flowcap/shared";
import { HttpError } from "../lib/http-error.js";
import { verifyAccessToken } from "../lib/jwt.js";

// Augment Express' Request with the authenticated user id.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw HttpError.unauthenticated("Missing bearer token.");
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new HttpError(ErrorCode.TOKEN_EXPIRED);
    }
    throw new HttpError(ErrorCode.TOKEN_INVALID);
  }
};

/** Helper for handlers that run behind `requireAuth` — asserts and returns the id. */
export function getUserId(req: Express.Request): string {
  if (!req.userId) throw HttpError.unauthenticated();
  return req.userId;
}
