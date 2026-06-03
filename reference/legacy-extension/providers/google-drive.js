// Google Drive provider.
//
// Auth uses chrome.identity.getAuthToken, which relies on the `oauth2` block in
// manifest.json (client_id + scopes). Chrome handles the token lifecycle and
// refresh for us, so we never hold a client secret. See README for the one-time
// Google Cloud Console setup.
//
// Scope used for uploads is drive.file — MyLoom can only see/manage files it
// created, never the user's whole Drive. That keeps the consent screen honest.

import { registerProvider } from "./provider.js";

const ROOT_FOLDER_NAME = "MyLoom";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const ACCOUNT_CACHE_KEY = "gdrive_account";

function getToken(interactive) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (result) => {
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      // Chrome may return a raw string or { token } depending on version.
      const token = typeof result === "string" ? result : result && result.token;
      if (!token) return reject(new Error("Could not obtain a Google access token."));
      resolve(token);
    });
  });
}

function removeCachedToken(token) {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

// Wraps a Drive REST call; transparently refreshes a stale token once.
async function api(path, { method = "GET", headers = {}, body, interactive = false } = {}) {
  let token = await getToken(interactive);
  const doFetch = (tok) =>
    fetch(path, { method, headers: { ...headers, Authorization: `Bearer ${tok}` }, body });

  let res = await doFetch(token);
  if (res.status === 401) {
    await removeCachedToken(token);
    token = await getToken(interactive);
    res = await doFetch(token);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Drive API ${res.status}: ${text || res.statusText}`);
  }
  return res;
}

async function fetchAccount(interactive) {
  const res = await api(USERINFO_URL, { interactive });
  const info = await res.json();
  const account = { email: info.email, name: info.name || info.email };
  await chrome.storage.local.set({ [ACCOUNT_CACHE_KEY]: account });
  return account;
}

const googleDrive = {
  id: "google-drive",
  label: "Google Drive",

  async connect() {
    // interactive: shows the Google consent screen if needed.
    return fetchAccount(true);
  },

  async disconnect() {
    try {
      const token = await getToken(false);
      // Best-effort revoke so the next connect re-prompts cleanly.
      await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: "POST" }).catch(
        () => {}
      );
      await removeCachedToken(token);
    } catch {
      /* already disconnected */
    }
    await chrome.storage.local.remove(ACCOUNT_CACHE_KEY);
  },

  async getAccount() {
    const { [ACCOUNT_CACHE_KEY]: account } = await chrome.storage.local.get(ACCOUNT_CACHE_KEY);
    return account || null;
  },

  async isConnected() {
    try {
      await getToken(false); // non-interactive: succeeds only if already authorized
      return true;
    } catch {
      return false;
    }
  },

  async ensureFolder(name = ROOT_FOLDER_NAME) {
    const q = [
      `name='${name.replace(/'/g, "\\'")}'`,
      "mimeType='application/vnd.google-apps.folder'",
      "trashed=false",
    ].join(" and ");
    const url = `${DRIVE_FILES}?q=${encodeURIComponent(q)}&fields=files(id,name)&spaces=drive`;
    const res = await api(url);
    const { files } = await res.json();
    if (files && files.length) return files[0].id;

    const createRes = await api(DRIVE_FILES, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
    });
    const folder = await createRes.json();
    return folder.id;
  },

  // Resumable upload with real progress events (needs XHR; fetch can't report
  // upload progress). One initiation request, then a single PUT of the blob.
  async uploadFile({ blob, name, mimeType, folderId, onProgress }) {
    const parent = folderId || (await this.ensureFolder());
    const token = await getToken(false).catch(() => getToken(true));

    const initRes = await fetch(`${DRIVE_UPLOAD}?uploadType=resumable&fields=id`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
      },
      body: JSON.stringify({ name, parents: [parent], mimeType }),
    });
    if (!initRes.ok) {
      throw new Error(`Drive upload init failed (${initRes.status}): ${await initRes.text()}`);
    }
    const sessionUri = initRes.headers.get("Location");
    if (!sessionUri) throw new Error("Drive did not return an upload session URI.");

    const fileId = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", sessionUri, true);
      xhr.setRequestHeader("Content-Type", mimeType);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText).id);
          } catch {
            reject(new Error("Could not parse Drive upload response."));
          }
        } else {
          reject(new Error(`Drive upload failed (${xhr.status}): ${xhr.responseText}`));
        }
      };
      xhr.onerror = () => reject(new Error("Network error during Drive upload."));
      xhr.send(blob);
    });

    // Sharing is applied by the caller (publish.js) based on user settings.
    return { fileId, viewUrl: `https://drive.google.com/file/d/${fileId}/view` };
  },

  async setSharing(fileId, access) {
    if (access === "anyone") {
      await api(`${DRIVE_FILES}/${fileId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone", allowFileDiscovery: false }),
      });
    }
    return { viewUrl: `https://drive.google.com/file/d/${fileId}/view` };
  },
};

registerProvider(googleDrive);
export default googleDrive;
