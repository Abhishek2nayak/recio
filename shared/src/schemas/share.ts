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
