/**
 * Refresh-token cookie helpers. The refresh token lives in an httpOnly cookie so
 * it's invisible to JS (XSS-resistant); the access token is returned in the body
 * and held in memory by the client.
 */
import type { Response } from "express";
import { isProd } from "../config/env.js";

export const REFRESH_COOKIE = "flowcap_rt";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "strict" : "lax",
    path: "/",
    maxAge: SEVEN_DAYS_MS,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: "/" });
}
