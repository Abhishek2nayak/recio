/**
 * Canonical enums shared across server (Prisma), web, and extension.
 *
 * These are declared as `as const` objects (not TS `enum`s) so they erase cleanly
 * under `isolatedModules`/`verbatimModuleSyntax` and tree-shake in the browser
 * bundles. The matching string-literal union type is derived from each object.
 */

/** Where a piece of media physically lives. */
export const StorageProvider = {
  /** The user's own Google Drive. */
  DRIVE: "DRIVE",
  /** The user's own Dropbox. */
  DROPBOX: "DROPBOX",
  /** Recio's own S3-compatible storage. */
  FLOWCAP: "FLOWCAP",
} as const;
export type StorageProvider = (typeof StorageProvider)[keyof typeof StorageProvider];

/** Account plan. Capabilities per plan live in `entitlements.ts`. */
export const Plan = {
  FREE: "FREE",
  PRO: "PRO",
  BUSINESS: "BUSINESS",
} as const;
export type Plan = (typeof Plan)[keyof typeof Plan];

/** Lifecycle of an AI transcript job. */
export const TranscriptStatus = {
  PROCESSING: "PROCESSING",
  READY: "READY",
  FAILED: "FAILED",
} as const;
export type TranscriptStatus = (typeof TranscriptStatus)[keyof typeof TranscriptStatus];

/** A member's role within a team workspace. */
export const WorkspaceRole = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;
export type WorkspaceRole = (typeof WorkspaceRole)[keyof typeof WorkspaceRole];

/** The two kinds of media Recio manages. */
export const ResourceType = {
  RECORDING: "RECORDING",
  SCREENSHOT: "SCREENSHOT",
} as const;
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

/** What a share link grants. Comment is reserved for Phase 2 but modeled now. */
export const SharePermission = {
  VIEW: "VIEW",
  COMMENT: "COMMENT",
} as const;
export type SharePermission = (typeof SharePermission)[keyof typeof SharePermission];

/**
 * Link visibility as presented in the UI ("Anyone with link" vs "Private").
 * Maps to the `isPublic` boolean on a media row; this enum is the human-facing label.
 */
export const LinkVisibility = {
  PUBLIC: "PUBLIC",
  PRIVATE: "PRIVATE",
} as const;
export type LinkVisibility = (typeof LinkVisibility)[keyof typeof LinkVisibility];

/** Surfaces offered to `getDisplayMedia` — the user picks one in the native picker. */
export const DisplaySurface = {
  MONITOR: "monitor",
  WINDOW: "window",
  BROWSER: "browser",
} as const;
export type DisplaySurface = (typeof DisplaySurface)[keyof typeof DisplaySurface];

/** MIME types Recio produces/accepts. */
export const VideoMimeType = {
  WEBM: "video/webm",
  MP4: "video/mp4",
} as const;
export type VideoMimeType = (typeof VideoMimeType)[keyof typeof VideoMimeType];

export const ImageMimeType = {
  PNG: "image/png",
  JPEG: "image/jpeg",
} as const;
export type ImageMimeType = (typeof ImageMimeType)[keyof typeof ImageMimeType];
