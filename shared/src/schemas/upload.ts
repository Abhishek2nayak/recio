import { z } from "zod";
import { ImageMimeType, ResourceType, VideoMimeType } from "../constants/enums.js";
import { UPLOAD } from "../constants/limits.js";

const anyMediaMime = z.union([z.nativeEnum(VideoMimeType), z.nativeEnum(ImageMimeType)]);

/**
 * Ask the server to open a Drive resumable upload session. The server uses the
 * user's stored (encrypted) Drive token to create the session and returns the
 * opaque `sessionUri`; the client then PUTs the bytes directly to Drive in chunks.
 */
export const initiateDriveUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: anyMediaMime,
  sizeBytes: z.number().int().positive().max(UPLOAD.MAX_FILE_BYTES),
  resourceType: z.nativeEnum(ResourceType),
});
export type InitiateDriveUploadInput = z.infer<typeof initiateDriveUploadSchema>;

export interface InitiateDriveUploadResult {
  /** Opaque Drive resumable session URI the client PUTs chunks to. */
  sessionUri: string;
  /** The Drive folder the file will land in. */
  folderId: string;
}

/**
 * Ask the server to mint a Supabase signed upload URL for the "Save to FlowCap"
 * path. The server returns a one-time URL + token scoped to a single object path;
 * the client uploads the bytes straight to Supabase Storage (never through us).
 */
export const initiateServerUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: anyMediaMime,
  sizeBytes: z.number().int().positive().max(UPLOAD.MAX_FILE_BYTES),
  resourceType: z.nativeEnum(ResourceType),
});
export type InitiateServerUploadInput = z.infer<typeof initiateServerUploadSchema>;

export interface InitiateServerUploadResult {
  /** The object key/path within the bucket — store this as `storageFileId`. */
  path: string;
  /** Absolute one-time signed upload URL the client PUTs the file to. */
  signedUrl: string;
  /** Token that authorizes the signed upload (for clients using supabase-js). */
  token: string;
}
