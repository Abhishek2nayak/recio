/**
 * Vyooom-styled library cards (grid tile + stream row) wired to a real `MediaDTO`.
 * Faithful to the handoff's GridCard / StreamRow: capture thumbnail, hover lift +
 * play affordance, space/provider label, title clamp, view/comment stats, and an
 * inline share menu (public ↔ private + copy link).
 */
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ResourceType, formatDuration, type MediaDTO } from "@flowcap/shared";
import { useDrivePermission } from "../../hooks/useDrivePermission.js";
import { Avatar, IconBtn, Tag } from "./primitives.js";
import { Icons, ReticleMark } from "./icons.js";

/** Deterministic hue (0–360) from a string, so each capture gets a stable color. */
function hueFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function relativeDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const PROVIDER_LABEL: Record<string, string> = { DRIVE: "Drive", DROPBOX: "Dropbox", FLOWCAP: "Vyooom" };

function hrefFor(m: MediaDTO): string {
  return m.resourceType === ResourceType.RECORDING ? `/recordings/${m.id}` : `/screenshots/${m.id}`;
}

/* ---------------- Thumbnail (real preview or reticle placeholder) ---------------- */
function CardThumb({
  m,
  hue,
  ratio = "16 / 10",
  hover,
}: {
  m: MediaDTO;
  hue: number;
  ratio?: string;
  hover?: boolean;
}) {
  const isRec = m.resourceType === ResourceType.RECORDING;
  const preview = m.previewUrl ?? m.thumbnailUrl ?? null;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const label = PROVIDER_LABEL[m.storageProvider] ?? "capture";
  const duration = isRec && m.duration > 0 ? formatDuration(m.duration) : isRec ? "" : "shot";

  return (
    <div
      style={{
        position: "relative",
        aspectRatio: ratio,
        borderRadius: "var(--r)",
        overflow: "hidden",
        background: "var(--hud)",
        border: "1px solid var(--line)",
      }}
      onMouseEnter={() => {
        if (isRec) void videoRef.current?.play().catch(() => {});
      }}
      onMouseLeave={() => videoRef.current?.pause()}
    >
      {preview ? (
        isRec ? (
          <video
            ref={videoRef}
            src={preview}
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              try {
                e.currentTarget.currentTime = 0.1;
              } catch {
                /* non-seekable */
              }
            }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", background: "var(--hud)" }}
          />
        ) : (
          <img
            src={preview}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(120% 120% at 30% 18%, oklch(0.32 0.04 ${hue}) 0%, oklch(0.2 0.02 ${hue}) 55%, oklch(0.16 0.012 262) 100%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.5,
              backgroundImage:
                "repeating-linear-gradient(135deg, rgba(255,255,255,.045) 0 1px, transparent 1px 11px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: "22%",
              color: "rgba(255,255,255,.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ReticleMark size="38%" sw={1.4} dot={false} color="currentColor" />
          </div>
        </>
      )}
      <span
        className="mono"
        style={{
          position: "absolute",
          left: 9,
          top: 8,
          fontSize: 10,
          color: "rgba(255,255,255,.6)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {duration && (
        <span
          className="mono"
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            fontSize: 11,
            fontWeight: 600,
            color: "white",
            background: "rgba(0,0,0,.42)",
            padding: "2px 6px",
            borderRadius: 5,
            backdropFilter: "blur(4px)",
          }}
        >
          {duration}
        </span>
      )}
      {hover && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--r)",
            background: "oklch(0.16 0.01 262 / 0.25)",
          }}
        >
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              background: "rgba(255,255,255,.94)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink)",
              boxShadow: "var(--e2)",
            }}
          >
            <Icons.Play size={18} style={{ marginLeft: 2 }} />
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------------- Grid card ---------------- */
/** Hover quick actions (Loom-style): copy link, download the file, delete. */
export interface CardActions {
  shareUrl?: string;
  downloadUrl?: string | null;
  onDelete?: () => void;
}

export function GridCard({ media, i = 0, actions }: { media: MediaDTO; i?: number; actions?: CardActions }) {
  const [hov, setHov] = useState(false);
  const [copied, setCopied] = useState(false);

  function act(e: React.MouseEvent, run: () => void) {
    e.preventDefault(); // the whole card is a <Link>
    e.stopPropagation();
    run();
  }
  const hue = hueFor(media.id || media.title);
  const ownerName = media.title; // library is the owner's own — meta shows views
  void ownerName;
  return (
    <Link
      to={hrefFor(media)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 11,
        cursor: "pointer",
        textDecoration: "none",
        color: "inherit",
        animation: "r-fade-up var(--t3) var(--ease) both",
        animationDelay: `${i * 28}ms`,
      }}
    >
      <div
        style={{
          position: "relative",
          transform: hov ? "translateY(-3px)" : "none",
          transition: "transform var(--t2) var(--ease), box-shadow var(--t2)",
          borderRadius: "var(--r)",
          boxShadow: hov ? "var(--e3)" : "none",
        }}
      >
        <CardThumb m={media} hue={hue} hover={hov} />
        {actions && hov && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              display: "flex",
              gap: 4,
              padding: 4,
              borderRadius: 10,
              background: "rgba(12,14,18,.72)",
              backdropFilter: "blur(8px)",
            }}
          >
            {actions.shareUrl && (
              <QuickBtn
                title={copied ? "Copied!" : "Copy share link"}
                onClick={(e) =>
                  act(e, () => {
                    void navigator.clipboard.writeText(actions.shareUrl!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1200);
                  })
                }
              >
                {copied ? <Icons.Check size={14} /> : <Icons.Link size={14} />}
              </QuickBtn>
            )}
            {actions.downloadUrl && (
              <QuickBtn
                title="Download"
                onClick={(e) =>
                  act(e, () => {
                    const a = document.createElement("a");
                    a.href = actions.downloadUrl!;
                    a.download = media.title || "recio-capture";
                    a.target = "_blank";
                    a.rel = "noopener";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  })
                }
              >
                <Icons.Download size={14} />
              </QuickBtn>
            )}
            {actions.onDelete && (
              <QuickBtn title="Delete" onClick={(e) => act(e, () => actions.onDelete!())}>
                <Icons.Trash size={14} />
              </QuickBtn>
            )}
          </div>
        )}
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          <Tag tone={media.isPublic ? "accent" : "neutral"} style={{ height: 18, fontSize: 10 }}>
            {media.isPublic ? "Shared" : "Private"}
          </Tag>
          {media.resourceType === "RECORDING" && media.uploadStatus === "UPLOADING" && (
            <Tag tone="neutral" style={{ height: 18, fontSize: 10 }}>
              Uploading…
            </Tag>
          )}
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
            {PROVIDER_LABEL[media.storageProvider] ?? "Vyooom"}
          </span>
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.35,
            color: "var(--ink)",
            marginBottom: 9,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {media.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={media.title} hue={hue} size={22} />
          <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{relativeDate(media.createdAt)}</span>
          <span
            className="mono"
            style={{
              marginLeft: "auto",
              fontSize: 11.5,
              color: "var(--ink-4)",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Icons.Eye size={13} />
            {media.viewCount}
          </span>
        </div>
      </div>
    </Link>
  );
}

/* ---------------- Stream row ---------------- */
export function StreamRow({ media, i = 0 }: { media: MediaDTO; i?: number }) {
  const [hov, setHov] = useState(false);
  const hue = hueFor(media.id || media.title);
  return (
    <Link
      to={hrefFor(media)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 14px",
        borderRadius: "var(--r-lg)",
        cursor: "pointer",
        textDecoration: "none",
        color: "inherit",
        background: hov ? "var(--surface)" : "transparent",
        boxShadow: hov ? "var(--e1)" : "none",
        border: "1px solid",
        borderColor: hov ? "var(--line)" : "transparent",
        transition: "all var(--t1)",
        animation: "r-fade-up var(--t2) var(--ease) both",
        animationDelay: `${i * 22}ms`,
      }}
    >
      <div style={{ width: 132, flexShrink: 0 }}>
        <CardThumb m={media} hue={hue} ratio="16 / 10" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
          <Tag tone={media.isPublic ? "accent" : "neutral"} style={{ height: 18, fontSize: 10 }}>
            {media.isPublic ? "Shared" : "Private"}
          </Tag>
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>
            {PROVIDER_LABEL[media.storageProvider] ?? "Vyooom"}
          </span>
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--ink)",
            marginBottom: 6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {media.title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={media.title} hue={hue} size={20} />
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{relativeDate(media.createdAt)}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 22, flexShrink: 0 }}>
        <span
          className="mono"
          style={{ fontSize: 12.5, color: "var(--ink-3)", display: "inline-flex", alignItems: "center", gap: 5 }}
        >
          <Icons.Eye size={14} />
          {media.viewCount}
        </span>
        <ShareMenu media={media} />
      </div>
    </Link>
  );
}

/* ---------------- Inline share menu ---------------- */
function ShareMenu({ media }: { media: MediaDTO }) {
  const { setVisibility, pending } = useDrivePermission();
  const [isPublic, setIsPublic] = useState(media.isPublic);
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/s/${media.shareToken}`;

  async function setPublic(next: boolean) {
    if (next === isPublic) return;
    setIsPublic(next);
    const ok = await setVisibility(media.shareToken, next);
    if (!ok) setIsPublic(!next);
  }
  async function copy() {
    if (!isPublic) await setPublic(true);
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  const swallow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <span onClick={swallow} style={{ display: "inline-flex" }}>
          <IconBtn icon={Icons.More} size={32} title="Share options" />
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          onClick={(e) => e.stopPropagation()}
          style={{
            zIndex: 50,
            minWidth: 200,
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: 5,
            fontSize: 13,
            boxShadow: "var(--e3)",
          }}
        >
          <DropdownMenu.RadioGroup value={isPublic ? "public" : "private"}>
            <MenuRadio value="public" disabled={pending} onSelect={() => void setPublic(true)} icon={Icons.Globe}>
              Anyone with the link
            </MenuRadio>
            <MenuRadio value="private" disabled={pending} onSelect={() => void setPublic(false)} icon={Icons.Shield}>
              Private
            </MenuRadio>
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator style={{ margin: "5px 0", height: 1, background: "var(--line)" }} />
          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              void copy();
            }}
            style={menuItemStyle}
          >
            {copied ? <Icons.Check size={15} /> : <Icons.Copy size={15} />}
            {copied ? "Link copied" : "Copy link"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  cursor: "pointer",
  alignItems: "center",
  gap: 8,
  borderRadius: "var(--r-sm)",
  padding: "8px 10px",
  outline: "none",
  color: "var(--ink)",
};

function MenuRadio({
  value,
  disabled,
  onSelect,
  icon: Ico,
  children,
}: {
  value: string;
  disabled: boolean;
  onSelect: () => void;
  icon: typeof Icons.Globe;
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
      style={{ ...menuItemStyle, paddingRight: 30, position: "relative", opacity: disabled ? 0.5 : 1 }}
    >
      <Ico size={15} />
      {children}
      <DropdownMenu.ItemIndicator style={{ position: "absolute", right: 10, color: "var(--accent-ink)" }}>
        <Icons.Check size={15} />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}

function QuickBtn({ title, onClick, children }: { title: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        border: "none",
        borderRadius: 7,
        background: "transparent",
        color: "white",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,.16)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}
