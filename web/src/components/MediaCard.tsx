/** A media tile for the dashboard grid: thumbnail, title, meta, and a quick
 *  visibility/share menu (per-file public ↔ private, copy link) — no detail-page
 *  round-trip needed. */
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ResourceType, formatDuration, type MediaDTO } from "@flowcap/shared";
import { useDrivePermission } from "../hooks/useDrivePermission.js";
import { CheckIcon, CopyIcon, GlobeIcon, ImageIcon, LockIcon, MoreIcon, PlayIcon, VideoIcon } from "./icons.js";

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function MediaCard({ media }: { media: MediaDTO }) {
  const isRecording = media.resourceType === ResourceType.RECORDING;
  const href = isRecording ? `/recordings/${media.id}` : `/screenshots/${media.id}`;
  const [isPublic, setIsPublic] = useState(media.isPublic);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Link
      to={href}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-video overflow-hidden bg-bg-secondary">
        <Thumbnail
          isRecording={isRecording}
          previewUrl={media.previewUrl ?? media.thumbnailUrl ?? null}
        />
        {isRecording && media.duration > 0 && (
          <span className="absolute bottom-2 right-2 z-[1] rounded bg-black/75 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {formatDuration(media.duration)}
          </span>
        )}

        <CardMenu
          shareToken={media.shareToken}
          isPublic={isPublic}
          onChange={setIsPublic}
          open={menuOpen}
          onOpenChange={setMenuOpen}
        />
      </div>

      <div className="p-3">
        <p className="truncate text-sm font-medium text-text-primary">{media.title}</p>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
          <span>{relativeDate(media.createdAt)}</span>
          <span aria-hidden>·</span>
          <span>{media.viewCount} {media.viewCount === 1 ? "view" : "views"}</span>
          <span className="ml-auto">
            {isPublic ? (
              <span className="rounded-full bg-highlight px-1.5 py-0.5 font-medium text-accent-on">Shared</span>
            ) : (
              <span className="rounded-full bg-bg-primary px-1.5 py-0.5 font-medium text-muted ring-1 ring-border">
                Private
              </span>
            )}
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Card thumbnail. Screenshots show the image; recordings show a seeked poster frame
 * from the (proxied) video and play a muted loop on hover — no separate thumbnail
 * storage needed. Same-origin proxy means no canvas/CORS tainting.
 */
function Thumbnail({ isRecording, previewUrl }: { isRecording: boolean; previewUrl: string | null }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  if (!previewUrl) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-bg-secondary to-border text-muted">
        {isRecording ? <VideoIcon width={28} height={28} /> : <ImageIcon width={28} height={28} />}
      </div>
    );
  }

  if (!isRecording) {
    return <img src={previewUrl} alt="" className="h-full w-full object-cover" />;
  }

  return (
    <div
      className="h-full w-full"
      onMouseEnter={() => void videoRef.current?.play().catch(() => {})}
      onMouseLeave={() => videoRef.current?.pause()}
    >
      <video
        ref={videoRef}
        src={previewUrl}
        muted
        loop
        playsInline
        preload="metadata"
        // Nudge off frame 0 so the poster isn't a black first frame.
        onLoadedMetadata={(e) => {
          try {
            e.currentTarget.currentTime = 0.1;
          } catch {
            /* non-seekable — first frame is fine */
          }
        }}
        className="h-full w-full bg-black object-cover"
      />
      {/* Kiwi play affordance; fades out on hover while the clip previews. */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-100 transition-opacity group-hover:opacity-0">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-highlight text-accent-on shadow-lg">
          <PlayIcon width={18} height={18} />
        </span>
      </span>
    </div>
  );
}

/**
 * The per-card share menu. Lives inside the card's <Link>, so the trigger swallows
 * its click (preventDefault + stopPropagation) to avoid navigating; the menu items
 * render in a portal, outside the link, so they never bubble into it.
 */
function CardMenu({
  shareToken,
  isPublic,
  onChange,
  open,
  onOpenChange,
}: {
  shareToken: string;
  isPublic: boolean;
  onChange: (v: boolean) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { setVisibility, pending } = useDrivePermission();
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/s/${shareToken}`;

  async function setPublic(next: boolean) {
    if (next === isPublic) return;
    onChange(next); // optimistic
    const ok = await setVisibility(shareToken, next);
    if (!ok) onChange(!next); // revert
  }

  async function copy() {
    if (!isPublic) await setPublic(true); // copying implies a shareable link
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const swallow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button
          onClick={swallow}
          aria-label="Share options"
          className={clsxOpen(open)}
        >
          <MoreIcon width={16} height={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          onClick={(e) => e.stopPropagation()}
          className="z-50 min-w-[200px] rounded-xl border border-border bg-card p-1 text-sm shadow-lg"
        >
          <DropdownMenu.RadioGroup value={isPublic ? "public" : "private"}>
            <MenuRadio value="public" disabled={pending} onSelect={() => void setPublic(true)}>
              <GlobeIcon width={15} height={15} /> Anyone with the link
            </MenuRadio>
            <MenuRadio value="private" disabled={pending} onSelect={() => void setPublic(false)}>
              <LockIcon width={15} height={15} /> Private
            </MenuRadio>
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault(); // keep the menu open for the "Copied" flash
              void copy();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-bg-primary"
          >
            {copied ? <CheckIcon width={15} height={15} /> : <CopyIcon width={15} height={15} />}
            {copied ? "Link copied" : "Copy link"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function MenuRadio({
  value,
  disabled,
  onSelect,
  children,
}: {
  value: string;
  disabled: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.RadioItem
      value={value}
      disabled={disabled}
      onSelect={(e) => {
        e.preventDefault();
        onSelect();
      }}
      className="relative flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 pr-8 outline-none data-[highlighted]:bg-bg-primary data-[disabled]:opacity-50"
    >
      {children}
      <DropdownMenu.ItemIndicator className="absolute right-2.5 text-highlight">
        <CheckIcon width={15} height={15} />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}

/** Trigger chip: a white rounded button, shown on hover or while the menu is open. */
function clsxOpen(open: boolean): string {
  return [
    "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg",
    "bg-card text-text-primary shadow-md ring-1 ring-border transition-opacity hover:bg-bg-primary",
    open ? "opacity-100" : "opacity-0 group-hover:opacity-100",
  ].join(" ");
}
