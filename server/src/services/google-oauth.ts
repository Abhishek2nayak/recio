/**
 * Google OAuth wiring used by two flows:
 *  1. "Sign in with Google" — verify the ID token the client obtained.
 *  2. Drive connect (checkpoint 3) — exchange an auth code for access/refresh tokens.
 *
 * Both share one configured OAuth2 client (client id/secret + redirect URI from env).
 */
import { OAuth2Client } from "google-auth-library";
import { ErrorCode } from "@flowcap/shared";
import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export function createOAuthClient(redirectUri?: string): OAuth2Client {
  return new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: redirectUri ?? env.GOOGLE_OAUTH_REDIRECT_URI,
  });
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/** Verify a Google ID token (from "Sign in with Google") and extract the profile. */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const client = createOAuthClient();
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(ErrorCode.DRIVE_AUTH_FAILED, "Invalid Google credential.");
  }
  if (!payload?.sub || !payload.email) {
    throw new HttpError(ErrorCode.DRIVE_AUTH_FAILED, "Google credential missing required claims.");
  }
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}

/**
 * Exchange an auth code (from the extension's launchWebAuthFlow sign-in) for the
 * user's Google profile, by verifying the ID token in the token response.
 */
export async function exchangeCodeForProfile(
  code: string,
  redirectUri?: string,
): Promise<GoogleProfile> {
  const client = createOAuthClient(redirectUri);
  let idToken: string | null | undefined;
  try {
    const { tokens } = await client.getToken(code);
    idToken = tokens.id_token;
  } catch {
    throw new HttpError(ErrorCode.DRIVE_AUTH_FAILED, "Could not exchange the Google auth code.");
  }
  if (!idToken) {
    throw new HttpError(ErrorCode.DRIVE_AUTH_FAILED, "Google did not return an ID token.");
  }
  const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new HttpError(ErrorCode.DRIVE_AUTH_FAILED, "Google credential missing required claims.");
  }
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? null,
    picture: payload.picture ?? null,
  };
}

/** Build the consent-screen URL for the Drive connect flow. */
export function buildDriveConsentUrl(state: string, redirectUri?: string): string {
  const client = createOAuthClient(redirectUri);
  return client.generateAuthUrl({
    access_type: "offline", // request a refresh token
    prompt: "consent", // force refresh-token issuance on re-consent
    scope: DRIVE_SCOPES,
    state,
  });
}

export interface DriveTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: Date | null;
  email: string | null;
}

/** Exchange an auth code (from the consent redirect) for Drive tokens + the account email. */
export async function exchangeDriveCode(code: string, redirectUri?: string): Promise<DriveTokens> {
  const client = createOAuthClient(redirectUri);
  let tokens;
  try {
    ({ tokens } = await client.getToken(code));
  } catch {
    throw new HttpError(ErrorCode.DRIVE_AUTH_FAILED, "Could not exchange the Google auth code.");
  }
  if (!tokens.access_token) {
    throw new HttpError(ErrorCode.DRIVE_AUTH_FAILED, "Google did not return an access token.");
  }

  // Resolve the connected account's email from the id_token if present.
  let email: string | null = null;
  if (tokens.id_token) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: env.GOOGLE_CLIENT_ID,
      });
      email = ticket.getPayload()?.email ?? null;
    } catch {
      email = null;
    }
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    email,
  };
}
