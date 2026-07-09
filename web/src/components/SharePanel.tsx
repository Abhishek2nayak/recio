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
import { api, ApiError } from "../lib/api.js";
import { Button } from "./ui.js";
import { CheckIcon, CopyIcon } from "./icons.js";

const EXPIRY_PRESETS: { label: string; days: number | null }[] = [
  { label: "Never", days: null },
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
];

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

  // Privacy pack — passcode + expiry (owner-only controls).
  const [pw, setPw] = useState("");
  const [hasPassword, setHasPassword] = useState(false);
  const [expiryDays, setExpiryDays] = useState<number | null>(null);
  const [savingPw, setSavingPw] = useState(false);
  const [privacyErr, setPrivacyErr] = useState<string | null>(null);

  async function savePassword(clear = false) {
    setSavingPw(true);
    setPrivacyErr(null);
    try {
      await api.updateShareSettings(shareToken, { password: clear ? null : pw });
      setHasPassword(!clear);
      setPw("");
    } catch (e) {
      setPrivacyErr(e instanceof ApiError ? e.message : "Couldn't update passcode.");
    } finally {
      setSavingPw(false);
    }
  }

  async function saveExpiry(days: number | null) {
    setExpiryDays(days);
    setPrivacyErr(null);
    const expiresAt = days == null ? null : new Date(Date.now() + days * 86400_000).toISOString();
    try {
      await api.updateShareSettings(shareToken, { expiresAt });
    } catch (e) {
      setPrivacyErr(e instanceof ApiError ? e.message : "Couldn't update expiry.");
    }
  }

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

      {/* Privacy: passcode + expiry (only meaningful while the link is on) */}
      {isPublic && (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          {/* Passcode */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-text-primary">
              Passcode {hasPassword && <span className="text-[11px] font-normal text-accent">· protected</span>}
            </span>
            <div className="flex gap-2">
              <input
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder={hasPassword ? "Enter a new passcode" : "Add a passcode"}
                className="w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-xs text-text-primary outline-none"
              />
              <Button variant="secondary" size="sm" onClick={() => savePassword(false)} disabled={savingPw || !pw.trim()}>
                {savingPw ? "Saving…" : "Set"}
              </Button>
              {hasPassword && (
                <Button variant="ghost" size="sm" onClick={() => savePassword(true)} disabled={savingPw}>
                  Remove
                </Button>
              )}
            </div>
          </div>

          {/* Expiry */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-text-primary">Link expires</span>
            <div className="flex gap-2">
              {EXPIRY_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => saveExpiry(p.days)}
                  className={clsx(
                    "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                    expiryDays === p.days ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-text-primary",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {privacyErr && <p className="text-xs text-danger">{privacyErr}</p>}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
