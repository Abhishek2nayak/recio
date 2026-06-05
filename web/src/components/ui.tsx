/** Shared UI primitives on the Recio palette (web). */
import { clsx } from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { StorageProvider } from "@flowcap/shared";

type Variant = "primary" | "highlight" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  // Ink button: near-black with white text — the default primary action.
  primary: "bg-accent hover:bg-accent-hover text-white shadow-sm",
  // Electric-kiwi pop, reserved for the headline brand action; black foreground only.
  highlight: "bg-highlight hover:bg-highlight-hover text-[#0A0A0A] font-semibold shadow-sm",
  secondary: "bg-card border border-border hover:border-muted text-text-primary shadow-sm",
  ghost: "bg-transparent hover:bg-card text-muted hover:text-text-primary",
  danger: "bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20",
};
const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary",
        "outline-none transition-colors placeholder:text-muted focus:border-accent",
        className,
      )}
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

const BADGE: Record<StorageProvider, { label: string; tone: string; dot: string }> = {
  DRIVE: { label: "Drive", tone: "bg-accent/15 text-accent", dot: "bg-accent" },
  DROPBOX: { label: "Dropbox", tone: "bg-[#0061FF]/15 text-[#4c8dff]", dot: "bg-[#0061FF]" },
  FLOWCAP: { label: "Recio", tone: "bg-success/15 text-success", dot: "bg-success" },
};

export function StorageBadge({ provider, className }: { provider: StorageProvider; className?: string }) {
  const b = BADGE[provider] ?? BADGE.FLOWCAP;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium",
        b.tone,
        className,
      )}
    >
      <span className={clsx("h-1.5 w-1.5 rounded-full", b.dot)} />
      {b.label}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton animate-shimmer rounded-md", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("rounded-xl border border-border bg-card shadow-sm", className)}>{children}</div>
  );
}
