import { z } from "zod";

/**
 * Pro "custom branding" applied to a user's public share pages. Each field is
 * nullable so the client can clear it; omit a field to leave it unchanged.
 */
export const updateBrandingSchema = z
  .object({
    brandName: z.string().trim().max(60).nullable().optional(),
    brandLogoUrl: z.string().url().max(2048).nullable().optional(),
    ctaLabel: z.string().trim().max(40).nullable().optional(),
    ctaUrl: z.string().url().max(2048).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update." });
export type UpdateBrandingInput = z.infer<typeof updateBrandingSchema>;
