/**
 * Auth routes: email/password + "Sign in with Google".
 *
 *   POST /auth/register   create account, start a session
 *   POST /auth/login      email/password → session
 *   POST /auth/google     verify Google ID token → upsert user → session
 *   POST /auth/refresh    refresh cookie → new access token (rotates refresh)
 *   POST /auth/logout     clear the refresh cookie
 *   GET  /auth/me         current user (requires access token)
 *
 * Session = short access JWT in the body + a rotating refresh JWT in an httpOnly
 * cookie. New users get a default FLOWCAP storage connection so "Save to Recio"
 * works before they connect Drive.
 */
import { Router } from "express";
import type { Response } from "express";
import {
  ErrorCode,
  ok,
  StorageProvider,
  changePasswordSchema,
  googleCodeSchema,
  googleSignInSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "@flowcap/shared";
import type { User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt.js";
import { REFRESH_COOKIE, clearRefreshCookie, setRefreshCookie } from "../lib/cookies.js";
import { toUserDTO } from "../lib/dto.js";
import { HttpError } from "../lib/http-error.js";
import {
  exchangeCodeForProfile,
  verifyGoogleIdToken,
  type GoogleProfile,
} from "../services/google-oauth.js";
import { asyncHandler } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rate-limit.js";

export const authRouter: Router = Router();

/** Issue an access token and set the refresh cookie. */
function startSession(res: Response, userId: string): string {
  setRefreshCookie(res, signRefreshToken(userId));
  return signAccessToken(userId);
}

async function ensureFlowcapConnection(userId: string): Promise<void> {
  await prisma.storageConnection.upsert({
    where: { userId_provider: { userId, provider: StorageProvider.FLOWCAP } },
    update: {},
    create: { userId, provider: StorageProvider.FLOWCAP, isActive: true, isDefault: true },
  });
}

/** Find-or-create a user from a Google profile; links Google to an existing email. */
async function upsertGoogleUser(profile: GoogleProfile): Promise<User> {
  // Link by googleId first, then by email (claim an existing password account).
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: profile.googleId }, { email: profile.email }] },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: profile.email,
        googleId: profile.googleId,
        name: profile.name,
        avatar: profile.picture,
      },
    });
    await ensureFlowcapConnection(user.id);
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: profile.googleId, avatar: user.avatar ?? profile.picture },
    });
  }
  return user;
}

authRouter.post(
  "/register",
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body as import("@flowcap/shared").RegisterInput;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new HttpError(ErrorCode.EMAIL_ALREADY_EXISTS);

    const user = await prisma.user.create({
      data: { email, name: name ?? null, passwordHash: await hashPassword(password) },
    });
    await ensureFlowcapConnection(user.id);

    const accessToken = startSession(res, user.id);
    res.status(201).json(ok({ accessToken, user: toUserDTO(user) }));
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as import("@flowcap/shared").LoginInput;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw new HttpError(ErrorCode.INVALID_CREDENTIALS);
    }

    const accessToken = startSession(res, user.id);
    res.json(ok({ accessToken, user: toUserDTO(user) }));
  }),
);

// Web "Sign in with Google" — GIS ID token.
authRouter.post(
  "/google",
  authLimiter,
  validate(googleSignInSchema),
  asyncHandler(async (req, res) => {
    const { idToken } = req.body as import("@flowcap/shared").GoogleSignInInput;
    const user = await upsertGoogleUser(await verifyGoogleIdToken(idToken));
    const accessToken = startSession(res, user.id);
    res.json(ok({ accessToken, user: toUserDTO(user) }));
  }),
);

// Extension "Sign in with Google" — auth code from launchWebAuthFlow, exchanged here.
authRouter.post(
  "/google/code",
  authLimiter,
  validate(googleCodeSchema),
  asyncHandler(async (req, res) => {
    const { code, redirectUri } = req.body as import("@flowcap/shared").GoogleCodeInput;
    const user = await upsertGoogleUser(await exchangeCodeForProfile(code, redirectUri));
    const accessToken = startSession(res, user.id);
    res.json(ok({ accessToken, user: toUserDTO(user) }));
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw new HttpError(ErrorCode.UNAUTHENTICATED, "No refresh token.");

    let userId: string;
    try {
      userId = verifyRefreshToken(token).sub;
    } catch {
      clearRefreshCookie(res);
      throw new HttpError(ErrorCode.TOKEN_INVALID, "Refresh token invalid or expired.");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      clearRefreshCookie(res);
      throw new HttpError(ErrorCode.TOKEN_INVALID);
    }

    const accessToken = startSession(res, user.id); // rotate refresh too
    res.json(ok({ accessToken, user: toUserDTO(user) }));
  }),
);

authRouter.post("/logout", (_req, res) => {
  clearRefreshCookie(res);
  res.json(ok({ loggedOut: true }));
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: getUserId(req) } });
    if (!user) throw HttpError.notFound("User not found.");
    res.json(ok({ user: toUserDTO(user) }));
  }),
);

// ── Profile management ──
authRouter.patch(
  "/me",
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body as import("@flowcap/shared").UpdateProfileInput;
    const user = await prisma.user.update({ where: { id: getUserId(req) }, data: { name } });
    res.json(ok({ user: toUserDTO(user) }));
  }),
);

/**
 * Change (or set) the password. Accounts created via "Sign in with Google" have no
 * password yet — they may set one without `currentPassword`; everyone else must
 * present the current one.
 */
authRouter.post(
  "/password",
  requireAuth,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as import("@flowcap/shared").ChangePasswordInput;
    const user = await prisma.user.findUnique({ where: { id: getUserId(req) } });
    if (!user) throw HttpError.notFound("User not found.");
    if (user.passwordHash) {
      if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
        throw new HttpError(ErrorCode.INVALID_CREDENTIALS, "The current password is incorrect.");
      }
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    res.json(ok({ changed: true }));
  }),
);
