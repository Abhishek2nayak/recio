/** Small shared UI primitives for the extension surfaces, on the Vyooom palette. */
import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { StorageProvider } from "@flowcap/shared";

type Variant = "primary" | "highlight" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent hover:bg-accent-hover text-white",
  // Electric-kiwi pop for the signature action; black foreground only.
  highlight: "bg-highlight hover:bg-highlight-hover text-[#0A0A0A] font-semibold",
  secondary: "bg-card border border-border hover:border-muted text-text-primary",
  ghost: "bg-transparent hover:bg-card text-muted hover:text-text-primary",
  danger: "bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20",
};

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      aria-label="Loading"
    />
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-200"
        style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }}
      />
    </div>
  );
}

export function StorageBadge({ provider }: { provider: StorageProvider }) {

  // Ownership is the product: say WHOSE storage this is, not just the brand.
  function getStorageName(provider: StorageProvider) {
    switch (provider) {
      case "DRIVE":
        return "Your Google Drive";
      case "DROPBOX":
        return "Your Dropbox";
      default:
        return "Vyooom Cloud";
    }
  }
  const isDrive = provider === "DRIVE";
  const icon = provider === "DRIVE" ? "/assets/drive.png" : provider === "DROPBOX" ? "/assets/dropbox.png" : null;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px]",
        isDrive ? "bg-accent/15 text-accent" : "bg-success/15 text-success",
      )}
    >
      {icon && <img src={icon} alt="" style={{ width: 12, height: 12, objectFit: "contain" }} />}
      {getStorageName(provider)}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary",
        "outline-none placeholder:text-muted focus:border-accent",
        props.className,
      )}
    />
  );
}
