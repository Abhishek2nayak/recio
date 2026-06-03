import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(80).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** "Sign in with Google" (web) — the app sends the Google ID token it received via GIS. */
export const googleSignInSchema = z.object({
  idToken: z.string().min(1),
});
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;

/**
 * "Sign in with Google" (extension) — chrome.identity.launchWebAuthFlow returns an
 * auth *code*; the backend exchanges it (with the client secret) for the ID token.
 */
export const googleCodeSchema = z.object({
  code: z.string().min(1),
  redirectUri: z.string().url().optional(),
});
export type GoogleCodeInput = z.infer<typeof googleCodeSchema>;
