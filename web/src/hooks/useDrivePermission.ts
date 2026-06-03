/**
 * Flip a media item's link visibility. For Drive-backed media this triggers a
 * server-side Drive permission change (no page reload) — the spec's headline action.
 */
import { useState } from "react";
import { LinkVisibility } from "@flowcap/shared";
import { ApiError, api } from "../lib/api.js";

export function useDrivePermission() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setVisibility(shareToken: string, isPublic: boolean): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      await api.updateSharePermission(
        shareToken,
        isPublic ? LinkVisibility.PUBLIC : LinkVisibility.PRIVATE,
      );
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the link.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { setVisibility, pending, error };
}
