/** Centered auth layout shared by Login + Register. */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "./icons.js";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="dot-grid flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm animate-slide-up">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5 text-text-primary">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-highlight">
            <Logo width={18} height={18} />
          </span>
          <span className="text-lg font-semibold tracking-tight">Recio</span>
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>

        <p className="mt-5 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}
