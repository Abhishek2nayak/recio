import { z } from "zod";
import { LinkVisibility, ResourceType, SharePermission } from "../constants/enums.js";

export const createShareSchema = z.object({
  resourceType: z.nativeEnum(ResourceType),
  resourceId: z.string().min(1),
  permission: z.nativeEnum(SharePermission).default(SharePermission.VIEW),
  /** Optional expiry as an ISO string; omit for a non-expiring link. */
  expiresAt: z.string().datetime().optional(),
});
export type CreateShareInput = z.infer<typeof createShareSchema>;

/**
 * Flip a Drive-backed (or Recio-backed) link between "Anyone with link" and
 * "Private". For Drive media the server applies this against the Drive API.
 */
export const updateSharePermissionSchema = z.object({
  visibility: z.nativeEnum(LinkVisibility),
});
export type UpdateSharePermissionInput = z.infer<typeof updateSharePermissionSchema>;

/**
 * Privacy controls for a link (owner). `password`: a non-empty string sets/replaces the
 * passcode, "" or null clears it, undefined leaves it unchanged. `expiresAt`: ISO string
 * sets an expiry, null clears it, undefined leaves it unchanged.
 */
export const updateShareSettingsSchema = z
  .object({
    password: z.string().max(128).nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .refine((v) => v.password !== undefined || v.expiresAt !== undefined, {
    message: "Provide password and/or expiresAt.",
  });
export type UpdateShareSettingsInput = z.infer<typeof updateShareSettingsSchema>;

/** Viewer submits a passcode to open a password-gated link (public). */
export const unlockShareSchema = z.object({
  password: z.string().min(1).max(128),
});
export type UnlockShareInput = z.infer<typeof unlockShareSchema>;

/** Viewer requests AI-translated captions for a public share. */
export const translateShareSchema = z.object({
  lang: z.string().min(2).max(8),
});
export type TranslateShareInput = z.infer<typeof translateShareSchema>;
