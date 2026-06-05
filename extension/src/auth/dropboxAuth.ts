/**
 * Connect Dropbox from the extension via `chrome.identity.launchWebAuthFlow`. Same
 * pattern as Drive: request an auth code (offline access → refresh token), hand it to
 * our backend, which exchanges it and stores the encrypted tokens.
 */
import { config } from "../config.js";
import { api } from "../lib/api.js";

const AUTH_ENDPOINT = "https://www.dropbox.com/oauth2/authorize";

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

export async function connectDropbox(): Promise<void> {
  if (!config.dropboxClientId) {
    throw new Error("Missing VITE_DROPBOX_CLIENT_ID. Set it in the extension .env and rebuild.");
  }
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl =
    `${AUTH_ENDPOINT}?` +
    new URLSearchParams({
      client_id: config.dropboxClientId,
      response_type: "code",
      redirect_uri: redirectUri,
      token_access_type: "offline", // request a refresh token
    }).toString();

  const redirectUrl = await launch(authUrl);
  const code = new URL(redirectUrl).searchParams.get("code");
  if (!code) throw new Error("Dropbox did not return an authorization code.");

  await api.dropboxCallback(code, redirectUri);
}
