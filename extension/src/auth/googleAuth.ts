/**
 * Connect Google Drive from the extension using `chrome.identity.launchWebAuthFlow`.
 *
 * We request an auth *code* (response_type=code) with the chromiumapp.org redirect,
 * then hand the code to our backend, which exchanges it for tokens and stores the
 * (encrypted) refresh token. The extension never sees or holds the Drive secret.
 */
import { GOOGLE_SCOPES, config } from "../config.js";
import { api } from "../lib/api.js";
import { setSession, type Session } from "../lib/storage.js";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
/** Lightweight scopes for sign-in (no Drive — that's a separate, explicit step). */
const SIGNIN_SCOPES = ["openid", "email", "profile"];

function launch(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (redirectUrl) => {
      if (chrome.runtime.lastError || !redirectUrl) {
        reject(new Error(chrome.runtime.lastError?.message ?? "Authorization was cancelled."));
        return;
      }
      resolve(redirectUrl);
    });
  });
}

/** Run the consent flow and persist the connection on our backend. */
export async function connectDrive(): Promise<void> {
  if (!config.googleClientId) {
    throw new Error("Missing VITE_GOOGLE_CLIENT_ID. Set it in the extension .env and rebuild.");
  }
  const redirectUri = chrome.identity.getRedirectURL();

  const authUrl =
    `${AUTH_ENDPOINT}?` +
    new URLSearchParams({
      client_id: config.googleClientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: GOOGLE_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
    }).toString();

  const redirectUrl = await launch(authUrl);
  const code = new URL(redirectUrl).searchParams.get("code");
  if (!code) throw new Error("Google did not return an authorization code.");

  await api.driveCallback(code, redirectUri);
}

/**
 * "Sign in with Google" for the extension. Same launchWebAuthFlow code flow as Drive
 * connect, but with sign-in scopes; the backend exchanges the code and returns a
 * Recio session for the same account you'd get on the website.
 */
export async function signInWithGoogle(): Promise<Session> {
  if (!config.googleClientId) {
    throw new Error("Missing VITE_GOOGLE_CLIENT_ID. Set it in the extension .env and rebuild.");
  }
  const redirectUri = chrome.identity.getRedirectURL();

  const authUrl =
    `${AUTH_ENDPOINT}?` +
    new URLSearchParams({
      client_id: config.googleClientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: SIGNIN_SCOPES.join(" "),
      prompt: "select_account",
    }).toString();

  const redirectUrl = await launch(authUrl);
  const code = new URL(redirectUrl).searchParams.get("code");
  if (!code) throw new Error("Google did not return an authorization code.");

  const { accessToken, user } = await api.googleCode(code, redirectUri);
  const session: Session = { accessToken, user };
  await setSession(session);
  return session;
}
