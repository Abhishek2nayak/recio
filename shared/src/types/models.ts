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
  TranscriptStatus,
  VideoMimeType,
  WorkspaceRole,
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
  /** Team workspace this media lives in (shared library), or null for personal. */
  workspaceId: string | null;
  shareToken: string;
  isPublic: boolean;
  visibility: LinkVisibility;
  viewCount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** Instant-link lifecycle: UPLOADING = link exists, bytes still in flight. */
export type UploadStatus = "UPLOADING" | "READY";

export interface RecordingDTO extends MediaBase {
  resourceType: typeof ResourceType.RECORDING;
  description: string | null;
  /** Seconds. */
  duration: number;
  mimeType: VideoMimeType;
  /** UPLOADING while the bytes are still in flight (instant-link flow). */
  uploadStatus: UploadStatus;
  /** Non-destructive trim bounds (seconds); null = no trim. Players clamp to these. */
  trimStartSec: number | null;
  trimEndSec: number | null;
  /** Smart-cleanup skip ranges; null/[] = none. Players jump over these. */
  cuts: CutSegment[] | null;
  /** Non-destructive overlays (text/box/blur) drawn over playback; null/[] = none. */
  overlays: Overlay[] | null;
  /** Per-video call-to-action button shown on the share page; null = none. */
  ctaLabel: string | null;
  ctaUrl: string | null;
}

export interface ScreenshotDTO extends MediaBase {
  resourceType: typeof ResourceType.SCREENSHOT;
  mimeType: ImageMimeType;
}

export type MediaDTO = RecordingDTO | ScreenshotDTO;

/** A team workspace the current user belongs to. */
export interface WorkspaceDTO {
  id: string;
  name: string;
  /** The current user's role in this workspace. */
  role: WorkspaceRole;
  memberCount: number;
  createdAt: ISODateString;
}

/** A member of a workspace. */
export interface MemberDTO {
  userId: string;
  name: string | null;
  email: string;
  role: WorkspaceRole;
  joinedAt: ISODateString;
}

/** A pending invite (with its shareable accept link token). */
export interface InviteDTO {
  id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expiresAt: ISODateString;
  createdAt: ISODateString;
}

/** Monthly playback-streaming usage vs the plan's fair-use cap (bytes). */
export interface StreamUsageDTO {
  used: number;
  cap: number | null;
  periodStart: ISODateString;
}

/** Pro custom-branding for a user's public share pages; null fields = Recio default. */
export interface BrandingDTO {
  brandName: string | null;
  brandLogoUrl: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
}

/** A playback range to skip (smart cleanup), in seconds. */
export interface CutSegment {
  start: number;
  end: number;
}

/** A non-destructive overlay drawn over the video at playback (text / box / blur).
 *  x,y,w,h are fractions (0..1) of the frame; visible during [startSec, endSec]. */
export interface Overlay {
  id: string;
  type: "text" | "rect" | "blur";
  x: number;
  y: number;
  w: number;
  h: number;
  startSec: number;
  endSec: number;
  text?: string;
  color?: string;
}

/** Result of running smart cleanup on a recording. */
export interface CleanupResultDTO {
  cuts: CutSegment[];
  removedFiller: number;
  removedSilences: number;
  /** Seconds removed from playback. */
  savedSec: number;
}

/** One ASR word with its time bounds (seconds) — powers captions + smart cleanup. */
export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

/** AI transcript + summary for a recording. `null` from the API = not generated yet. */
/** A single caption cue (seconds) — used for translated caption tracks. */
export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

/** AI-translated captions for a share, returned by POST /share/:token/translate. */
export interface TranslatedCaptionsDTO {
  language: string;
  cues: CaptionCue[];
}

export interface TranscriptDTO {
  status: TranscriptStatus;
  language: string | null;
  title: string | null;
  summary: string | null;
  text: string | null;
  /** Word-level timestamps when available — clients build captions (VTT) from these. */
  words: TranscriptWord[] | null;
  error: string | null;
}

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
  /** Whether a viewer passcode is set (the hash itself is never returned). */
  hasPassword: boolean;
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
  /** Drive view URL or a time-limited signed Recio URL. Empty while `processing`. */
  playbackUrl: string;
  /** True while the recording's bytes are still uploading (instant-link flow). */
  processing: boolean;
  /** Canonical share URL (link-preview-capable) — what "Copy link" should copy. */
  shareUrl: string;
  duration: number | null;
  /** Non-destructive trim bounds (seconds, recordings); null = none. */
  trimStartSec: number | null;
  trimEndSec: number | null;
  /** Smart-cleanup skip ranges; null/[] = none. */
  cuts: CutSegment[] | null;
  /** Non-destructive overlays (text/box/blur) drawn over playback; null/[] = none. */
  overlays: Overlay[] | null;
  viewCount: number;
  ownerName: string | null;
  /** Owner's custom branding, resolved only when their plan includes it; else null. */
  branding: BrandingDTO | null;
  /** Call-to-action button: the recording's own CTA, else the owner's account CTA; null = none. */
  cta: { label: string; url: string } | null;
  createdAt: ISODateString;
  permission: SharePermission;
  /** Password-gated: true means the viewer must POST /share/:token/unlock first. When
   * locked, `playbackUrl` (and transcript/overlays) are withheld. */
  locked?: boolean;
}
