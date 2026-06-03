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
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 text-text-primary">
          <Logo className="text-accent" />
          <span className="text-lg font-semibold tracking-tight">FlowCap</span>
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-2xl">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-5">{children}</div>
        </div>

        <p className="mt-5 text-center text-sm text-muted">{footer}</p>
      </div>
    </div>
  );
}
