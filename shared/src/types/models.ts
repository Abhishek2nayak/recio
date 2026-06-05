/**
 * API-facing DTO shapes — the serialized forms returned over the wire.
 *
 * These deliberately differ from the Prisma row types: dates are ISO strings and
 * secrets (password hashes, encrypted Drive tokens) are never present. The server
 * maps Prisma rows → these DTOs before responding.
 */
import type {
  ImageMimeType,
  LinkVisibility,
  Plan,
  ResourceType,
  SharePermission,
  StorageProvider,
  VideoMimeType,
} from "../constants/enums.js";
import type { Entitlements } from "../constants/entitlements.js";

/** ISO-8601 timestamp string (e.g. "2026-06-02T12:00:00.000Z"). */
export type ISODateString = string;

export interface UserDTO {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  plan: Plan;
  /** Resolved capabilities for `plan` — clients gate UI off these (server re-checks). */
  entitlements: Entitlements;
  createdAt: ISODateString;
}

export interface StorageConnectionDTO {
  id: string;
  provider: StorageProvider;
  /** The connected Google account's email (for Drive). Null for Recio. */
  driveEmail: string | null;
  defaultFolderId: string | null;
  isActive: boolean;
  /** Whether this provider is the default destination for new uploads. */
  isDefault: boolean;
  createdAt: ISODateString;
}

/** Drive storage quota, when available from the provider. Bytes. */
export interface StorageQuotaDTO {
  used: number;
  limit: number | null;
}

interface MediaBase {
  id: string;
  title: string;
  size: number;
  storageProvider: StorageProvider;
  /** Drive file ID or Recio S3 object key. */
  storageFileId: string;
  thumbnailUrl: string | null;
  /** A loadable media URL, set on list/detail responses so cards can render a real
   *  poster (recordings) or the image (screenshots) and a hover preview. */
  previewUrl?: string | null;
  shareToken: string;
  isPublic: boolean;
  visibility: LinkVisibility;
  viewCount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface RecordingDTO extends MediaBase {
  resourceType: typeof ResourceType.RECORDING;
  description: string | null;
  /** Seconds. */
  duration: number;
  mimeType: VideoMimeType;
  /** Non-destructive trim bounds (seconds); null = no trim. Players clamp to these. */
  trimStartSec: number | null;
  trimEndSec: number | null;
}

export interface ScreenshotDTO extends MediaBase {
  resourceType: typeof ResourceType.SCREENSHOT;
  mimeType: ImageMimeType;
}

export type MediaDTO = RecordingDTO | ScreenshotDTO;

/** Engagement analytics for one media item (owner-only). */
export interface AnalyticsDTO {
  /** Total view sessions. */
  views: number;
  /** Distinct viewers (by anonymous viewerId). */
  uniqueViewers: number;
  /** Pro-gated deep stats. `null` when the owner's plan lacks `fullAnalytics`. */
  pro: {
    /** Mean watch-through across sessions, 0..100. */
    avgWatchedPct: number;
    /** Drop-off histogram: 10 buckets (0–10% … 90–100%), each a session count. */
    dropOff: number[];
  } | null;
}

export interface ShareDTO {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  token: string;
  permission: SharePermission;
  expiresAt: ISODateString | null;
  createdAt: ISODateString;
}

/**
 * Public payload returned by `GET /share/:token` (no auth). Carries just enough to
 * render the viewer — a playback URL (Drive view URL or a signed Recio URL) plus
 * lightweight media facts. Never exposes owner identity beyond a display name.
 */
export interface PublicShareViewDTO {
  resourceType: ResourceType;
  /** The media id — public viewers use it to react. */
  resourceId: string;
  title: string;
  mimeType: VideoMimeType | ImageMimeType;
  /** Drive view URL or a time-limited signed Recio URL. */
  playbackUrl: string;
  duration: number | null;
  /** Non-destructive trim bounds (seconds, recordings); null = none. */
  trimStartSec: number | null;
  trimEndSec: number | null;
  viewCount: number;
  ownerName: string | null;
  createdAt: ISODateString;
  permission: SharePermission;
}
