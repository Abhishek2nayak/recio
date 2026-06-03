/**
 * In-memory access token. Kept out of localStorage on purpose (XSS hygiene): the
 * durable credential is the httpOnly refresh cookie, and we re-mint the access token
 * on load via /auth/refresh. The auth store and the API client share this module.
 */
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
