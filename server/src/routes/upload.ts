/**
 * Upload coordination. The server never receives the media bytes — it only hands
 * the client a place to upload to:
 *
 *   POST  /upload/drive/initiate    open a Drive resumable session → sessionUri
 *   POST  /upload/server            mint a Supabase signed upload URL
 *   PATCH /upload/drive/permissions toggle a media item's "anyone with link" ACL
 */
import { Router } from "express";
import {
  ok,
  ResourceType,
  initiateDriveUploadSchema,
  initiateServerUploadSchema,
  updateSharePermissionSchema,
  LinkVisibility,
  type InitiateDriveUploadInput,
  type InitiateServerUploadInput,
  type InitiateDriveUploadResult,
  type InitiateServerUploadResult,
  type InitiateDropboxUploadResult,
} from "@flowcap/shared";
import { z } from "zod";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { initiateResumableUpload } from "../services/drive-service.js";
import { getUploadGrant } from "../services/dropbox-service.js";
import { createSignedUpload } from "../services/supabase-storage.js";
import { setMediaVisibility } from "../services/media-service.js";
import { toRecordingDTO, toScreenshotDTO } from "../lib/dto.js";

export const uploadRouter: Router = Router();

/**
 * Slugify a path segment to characters Supabase Storage accepts (ASCII word chars,
 * dot, dash). Non-ASCII (em-dashes, accents) and spaces/commas become "-". The
 * human-readable title lives in the DB; the storage key just has to be valid.
 */
function safeSegment(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 60)
      .toLowerCase() || "file"
  );
}

/** Build a tidy, collision-resistant, Supabase-safe object key. */
function objectKey(userId: string, resourceType: ResourceType, fileName: string): string {
  const folder = resourceType === ResourceType.RECORDING ? "recordings" : "screenshots";
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = safeSegment(dot >= 0 ? fileName.slice(0, dot) : fileName);
  return `${userId}/${folder}/${stamp}-${base}${ext ? `.${ext}` : ""}`;
}

uploadRouter.post(
  "/drive/initiate",
  requireAuth,
  validate(initiateDriveUploadSchema),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fileName, mimeType } = req.body as InitiateDriveUploadInput;
    const { sessionUri, folderId } = await initiateResumableUpload(userId, { fileName, mimeType });
    const result: InitiateDriveUploadResult = { sessionUri, folderId };
    res.json(ok(result));
  }),
);

uploadRouter.post(
  "/dropbox/initiate",
  requireAuth,
  validate(initiateDriveUploadSchema),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fileName, resourceType } = req.body as InitiateDriveUploadInput;
    const folder = resourceType === ResourceType.RECORDING ? "recordings" : "screenshots";
    const grant = await getUploadGrant(userId, `${Date.now()}-${safeSegment(fileName)}`, folder);
    const result: InitiateDropboxUploadResult = { accessToken: grant.accessToken, path: grant.path };
    res.json(ok(result));
  }),
);

uploadRouter.post(
  "/server",
  requireAuth,
  validate(initiateServerUploadSchema),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { fileName, resourceType } = req.body as InitiateServerUploadInput;
    const key = objectKey(userId, resourceType, fileName);
    const signed = await createSignedUpload(key);
    const result: InitiateServerUploadResult = {
      path: signed.path,
      signedUrl: signed.signedUrl,
      token: signed.token,
    };
    res.json(ok(result));
  }),
);

// Extension-facing visibility toggle by media id (web app uses PATCH /share/... too).
const drivePermissionSchema = updateSharePermissionSchema.extend({
  resourceType: z.nativeEnum(ResourceType),
  mediaId: z.string().min(1),
});

uploadRouter.patch(
  "/drive/permissions",
  requireAuth,
  validate(drivePermissionSchema),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { mediaId, resourceType, visibility } = req.body as z.infer<typeof drivePermissionSchema>;
    const isPublic = visibility === LinkVisibility.PUBLIC;
    const media = await setMediaVisibility(userId, resourceType, mediaId, isPublic);
    const dto =
      resourceType === ResourceType.RECORDING
        ? toRecordingDTO(media as import("@prisma/client").Recording)
        : toScreenshotDTO(media as import("@prisma/client").Screenshot);
    res.json(ok({ media: dto }));
  }),
);
