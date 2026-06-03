import { z } from "zod";
import { StorageProvider } from "../constants/enums.js";

/**
 * Body posted to the Drive OAuth callback. The extension uses `launchWebAuthFlow`
 * and posts the resulting `code` here; the web app hits the GET callback with the
 * same `code` as a query param. `redirectUri` must match what initiated the flow.
 */
export const driveCallbackSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url().optional(),
});
export type DriveCallbackInput = z.infer<typeof driveCallbackSchema>;

/** Choose which connected provider is the default destination for new uploads. */
export const setDefaultProviderSchema = z.object({
  provider: z.nativeEnum(StorageProvider),
});
export type SetDefaultProviderInput = z.infer<typeof setDefaultProviderSchema>;
