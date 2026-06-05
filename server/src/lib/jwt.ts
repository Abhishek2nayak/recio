/**
 * JWT issuing/verification. Two token types:
 *  - access  (short-lived, 15m) — sent in the Authorization header, kept in memory
 *  - refresh (long-lived, 7d)   — stored in an httpOnly cookie, rotated on refresh
 */
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string; // user id
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "access" } satisfies AccessTokenPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  } as SignOptions);
}

export function signRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: "refresh" } satisfies RefreshTokenPayload,
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_TTL } as SignOptions,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || decoded.type !== "access") {
    throw new Error("Not an access token");
  }
  return decoded as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (typeof decoded === "string" || decoded.type !== "refresh") {
    throw new Error("Not a refresh token");
  }
  return decoded as RefreshTokenPayload;
}

export interface PlaybackTokenPayload {
  sub: string; // owner user id (whose cloud holds the bytes)
  mid: string; // media id this token is scoped to
  type: "playback";
}

/**
 * Short-lived token that authorizes streaming ONE media item's bytes through our
 * proxy. Embedded in the playback URL (query param) because a <video>/<img> src
 * can't carry an Authorization header. Scoped to a single media id so a leaked URL
 * can't be used to enumerate other files.
 */
export function signPlaybackToken(ownerId: string, mediaId: string): string {
  return jwt.sign(
    { sub: ownerId, mid: mediaId, type: "playback" } satisfies PlaybackTokenPayload,
    env.JWT_ACCESS_SECRET,
    { expiresIn: "12h" } as SignOptions,
  );
}

export function verifyPlaybackToken(token: string): PlaybackTokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || decoded.type !== "playback" || !decoded.sub || !decoded.mid) {
    throw new Error("Not a playback token");
  }
  return decoded as PlaybackTokenPayload;
}

/**
 * Short-lived `state` token for the Drive OAuth redirect flow. Carries the user id
 * through the round-trip to Google so the (unauthenticated) GET callback can tell
 * who's connecting — and is signed, so it can't be forged (CSRF guard).
 */
export function signOAuthState(userId: string): string {
  return jwt.sign({ sub: userId, type: "oauth_state" }, env.JWT_ACCESS_SECRET, {
    expiresIn: "10m",
  } as SignOptions);
}

export function verifyOAuthState(token: string): string {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || decoded.type !== "oauth_state" || !decoded.sub) {
    throw new Error("Invalid OAuth state");
  }
  return decoded.sub as string;
}
