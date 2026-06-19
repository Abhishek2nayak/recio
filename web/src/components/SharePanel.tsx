/**
 * Share controls for a media detail page: copyable link + an "Anyone with link" ↔
 * "Private" toggle. Flipping it calls the backend, which (for Drive media) changes
 * the Drive file permission server-side — no reload.
 */
import { useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import { clsx } from "clsx";
import { StorageProvider } from "@flowcap/shared";
import { useDrivePermission } from "../hooks/useDrivePermission.js";
import { Button } from "./ui.js";
import { CheckIcon, CopyIcon } from "./icons.js";

export function SharePanel({
  shareToken,
  isPublic,
  provider,
  onChange,
}: {
  shareToken: string;
  isPublic: boolean;
  provider: StorageProvider;
  onChange: (isPublic: boolean) => void;
}) {
  const { setVisibility, pending, error } = useDrivePermission();
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/s/${shareToken}`;

  async function toggle(next: boolean) {
    onChange(next); // optimistic
    const okFlip = await setVisibility(shareToken, next);
    if (!okFlip) onChange(!next); // revert on failure
  }

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Share</h3>
        <span className="font-mono text-[11px] text-muted">
          {provider === StorageProvider.DRIVE ? "via Google Drive" : "via Vyooom"}
        </span>
      </div>

      {/* Visibility toggle */}
      <label className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-sm text-text-primary">{isPublic ? "Anyone with the link" : "Private"}</span>
          <span className="text-xs text-muted">
            {isPublic ? "Anyone can view this without signing in." : "Only you can open this."}
          </span>
        </span>
        <Switch.Root
          checked={isPublic}
          disabled={pending}
          onCheckedChange={toggle}
          className={clsx(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
            isPublic ? "bg-accent" : "bg-border",
          )}
        >
          <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform data-[state=checked]:translate-x-[22px]" />
        </Switch.Root>
      </label>

      {/* Link row */}
      <div className={clsx("flex gap-2", !isPublic && "opacity-50")}>
        <input
          readOnly
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-md border border-border bg-bg-secondary px-3 py-2 font-mono text-xs text-text-primary outline-none"
        />
        <Button variant="secondary" size="sm" onClick={copy} disabled={!isPublic}>
          {copied ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
