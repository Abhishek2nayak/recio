/**
 * Global upsell dialog. Mounted once at the app root; it listens for the
 * `recio:upgrade-required` window event that `api.ts` fires whenever the server
 * returns `UPGRADE_REQUIRED` (HTTP 402). Any gated call anywhere thus triggers a
 * consistent upgrade prompt without each caller wiring its own handling.
 *
 * The "Upgrade" CTA is a placeholder until billing (Phase 2) lands — it routes to
 * /settings, where the Stripe Checkout button will live.
 */
import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui.js";

const PRO_PERKS = [
  "Custom branding on share pages",
  "Password-protected & expiring links",
  "Full engagement analytics",
  "Folders, AI transcripts & more",
];

export function UpgradeModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onUpgrade(e: Event) {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      setMessage(detail?.message ?? null);
      setOpen(true);
    }
    window.addEventListener("recio:upgrade-required", onUpgrade);
    return () => window.removeEventListener("recio:upgrade-required", onUpgrade);
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl focus:outline-none">
          <span className="inline-flex items-center rounded-full bg-highlight px-2 py-0.5 text-xs font-semibold text-accent-on">
            Vyooom Pro
          </span>
          <Dialog.Title className="mt-3 text-lg font-semibold">
            Upgrade to unlock this
          </Dialog.Title>
          <Dialog.Description className="mt-1.5 text-sm text-muted">
            {message ?? "This feature is part of Vyooom Pro."}
          </Dialog.Description>

          <ul className="mt-4 space-y-2">
            {PRO_PERKS.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-text-primary">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-highlight text-accent-on">
                  <CheckGlyph />
                </span>
                {p}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost">Not now</Button>
            </Dialog.Close>
            <Button
              variant="highlight"
              onClick={() => {
                setOpen(false);
                navigate("/pricing");
              }}
            >
              See plans
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CheckGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
