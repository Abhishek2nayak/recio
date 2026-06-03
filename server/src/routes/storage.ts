/**
 * Storage / Drive connection routes.
 *
 *   GET    /storage/status            connected providers, default, Drive quota
 *   GET    /storage/drive/connect     → returns the Google consent URL (web app)
 *   GET    /storage/drive/callback    Google redirect (no auth; state-verified) → save tokens → redirect to web
 *   POST   /storage/drive/callback    extension flow: { code, redirectUri } → save tokens → connection DTO
 *   DELETE /storage/drive/disconnect  remove the Drive connection
 *   PATCH  /storage/default           choose the default upload destination
 */
import { Router } from "express";
import {
  ErrorCode,
  ok,
  StorageProvider,
  driveCallbackSchema,
  setDefaultProviderSchema,
  type SetDefaultProviderInput,
  type DriveCallbackInput,
} from "@flowcap/shared";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { signOAuthState, verifyOAuthState } from "../lib/jwt.js";
import { toStorageConnectionDTO } from "../lib/dto.js";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { buildDriveConsentUrl, exchangeDriveCode } from "../services/google-oauth.js";
import {
  disconnectDrive,
  getDefaultProvider,
  listConnections,
  saveDriveConnection,
  setDefaultProvider,
} from "../services/connection-service.js";
import { getStorageQuota } from "../services/drive-service.js";

export const storageRouter: Router = Router();

storageRouter.get(
  "/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const [connections, defaultProvider] = await Promise.all([
      listConnections(userId),
      getDefaultProvider(userId),
    ]);
    // Drive quota is an external API round-trip, so only fetch it when asked for
    // (the Settings page) — not on every popup/studio status check.
    const hasDrive = connections.some((c) => c.provider === StorageProvider.DRIVE && c.isActive);
    const wantQuota = req.query.quota === "1" || req.query.quota === "true";
    const driveQuota = hasDrive && wantQuota ? await getStorageQuota(userId) : null;

    res.json(
      ok({
        connections: connections.map(toStorageConnectionDTO),
        defaultProvider,
        driveQuota,
      }),
    );
  }),
);

storageRouter.get(
  "/drive/connect",
  requireAuth,
  asyncHandler(async (req, res) => {
    const state = signOAuthState(getUserId(req));
    res.json(ok({ url: buildDriveConsentUrl(state) }));
  }),
);

// Public: Google redirects the browser here after consent (no Authorization header).
storageRouter.get(
  "/drive/callback",
  asyncHandler(async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const settingsUrl = `${env.WEB_ORIGIN}/settings`;

    if (!code || !state) {
      res.redirect(`${settingsUrl}?drive=error`);
      return;
    }
    let userId: string;
    try {
      userId = verifyOAuthState(state);
    } catch {
      res.redirect(`${settingsUrl}?drive=error`);
      return;
    }

    const tokens = await exchangeDriveCode(code);
    await saveDriveConnection(userId, tokens);
    res.redirect(`${settingsUrl}?drive=connected`);
  }),
);

// Extension flow: launchWebAuthFlow returns a code; the extension POSTs it here.
storageRouter.post(
  "/drive/callback",
  requireAuth,
  validate(driveCallbackSchema),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { code, redirectUri } = req.body as DriveCallbackInput;
    const tokens = await exchangeDriveCode(code, redirectUri);
    const conn = await saveDriveConnection(userId, tokens);
    res.json(ok({ connection: toStorageConnectionDTO(conn) }));
  }),
);

storageRouter.delete(
  "/drive/disconnect",
  requireAuth,
  asyncHandler(async (req, res) => {
    await disconnectDrive(getUserId(req));
    res.json(ok({ disconnected: true }));
  }),
);

storageRouter.patch(
  "/default",
  requireAuth,
  validate(setDefaultProviderSchema),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { provider } = req.body as SetDefaultProviderInput;
    if (provider === StorageProvider.DRIVE) {
      // Guard: can't default to Drive unless it's connected.
      const conns = await listConnections(userId);
      if (!conns.some((c) => c.provider === StorageProvider.DRIVE && c.isActive)) {
        throw new HttpError(ErrorCode.STORAGE_NOT_CONNECTED, "Connect Google Drive first.");
      }
    }
    await setDefaultProvider(userId, provider);
    res.json(ok({ defaultProvider: provider }));
  }),
);
