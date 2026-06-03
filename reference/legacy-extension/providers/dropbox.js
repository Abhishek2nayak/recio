// Dropbox provider — scaffold only.
//
// This file exists to prove the provider seam: dropping in a second cloud is
// purely additive and touches nothing else in the app. Implement the methods
// (OAuth via chrome.identity.launchWebAuthFlow with PKCE, then the Dropbox
// /files/upload and /sharing/create_shared_link_with_settings endpoints) to
// light it up. Until then it advertises itself but reports "not connected".

import { registerProvider } from "./provider.js";

const NOT_IMPLEMENTED = () => {
  throw new Error("Dropbox isn't wired up yet — connect Google Drive for now.");
};

const dropbox = {
  id: "dropbox",
  label: "Dropbox",
  connect: NOT_IMPLEMENTED,
  async disconnect() {},
  async getAccount() {
    return null;
  },
  async isConnected() {
    return false;
  },
  ensureFolder: NOT_IMPLEMENTED,
  uploadFile: NOT_IMPLEMENTED,
  setSharing: NOT_IMPLEMENTED,
};

registerProvider(dropbox);
export default dropbox;
