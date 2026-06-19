/**
 * Turns raw upload failures (provider HTTP bodies, our API error codes, network
 * drops) into messages a person can act on. The raw text still goes to the console
 * for debugging; the user never sees "Upload failed (403): {json}".
 */
import { StorageProvider } from "@flowcap/shared";
import { ApiError } from "./api.js";
import { UploadHttpError } from "../storage/xhrUpload.js";

function providerName(provider: StorageProvider): string {
  if (provider === StorageProvider.DRIVE) return "Google Drive";
  if (provider === StorageProvider.DROPBOX) return "Dropbox";
  return "Vyooom Cloud";
}

export function friendlyUploadError(err: unknown, provider: StorageProvider): string {
  const name = providerName(provider);

  if (err instanceof ApiError) {
    // Backend errors (connection broken, account mismatch, …) already carry
    // user-facing messages with the right next step.
    return err.message;
  }

  if (err instanceof UploadHttpError) {
    if (err.status === 0) {
      return "The connection dropped during the upload.";
    }
    if (err.status === 401) {
      return `${name} rejected the upload session. Reconnect ${name} in Settings, then retry.`;
    }
    if (err.status === 403 && /quota|storage.*exceeded/i.test(err.responseText)) {
      return `Your ${name} is full. Free up space (or switch destination), then retry.`;
    }
    if (err.status === 507 || /insufficient_space/i.test(err.responseText)) {
      return `Your ${name} is full. Free up space (or switch destination), then retry.`;
    }
    if (err.status === 404) {
      return "The upload session expired. Retry to start a fresh upload.";
    }
    if (err.status === 429) {
      return `${name} is rate-limiting uploads right now. Wait a moment and retry.`;
    }
    if (err.status >= 500) {
      return `${name} had a temporary problem (${err.status}). Retry in a moment.`;
    }
  }

  return err instanceof Error ? err.message : "The upload failed.";
}
