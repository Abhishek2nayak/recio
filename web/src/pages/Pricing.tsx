/**
 * Pricing / plans page. Renders the three tiers from docs/monetization.md
 * (Free / Pro / Business) with a monthly–annual toggle and current-plan awareness.
 *
 * Checkout isn't wired yet (Stripe is Phase 2 — see the doc), so the CTAs surface a
 * "coming soon" notice rather than 404ing a /billing/checkout endpoint. When billing
 * lands, swap `onSelect` to hit `POST /billing/checkout` and redirect to Stripe.
 */
import { useState } from "react";
import { clsx } from "clsx";
import { Link, useNavigate } from "react-router-dom";
import { Plan } from "@flowcap/shared";
import { useAuthStore } from "../stores/authStore.js";
import { ApiError, api } from "../lib/api.js";
import { Button } from "../components/ui.js";
import { CheckIcon, Logo } from "../components/icons.js";

interface Tier {
  plan: Plan;
  name: string;
  tagline: string;
  monthly: number; // 0 = free
  annual: number; // per-month when billed annually
  perSeat?: boolean;
  cta: string;
  highlighted?: boolean;
  features: string[];
}

const TIERS: Tier[] = [
  {
    plan: Plan.FREE,
    name: "Free",
    tagline: "Record unlimited, to your own cloud.",
    monthly: 0,
    annual: 0,
    cta: "Get started",
    features: [
      "Unlimited recordings & screenshots",
      "Save to your own Google Drive / Dropbox",
      "Reliable playback + sharing links",
      "Comments & reactions",
      "5 AI transcript minutes / mo",
    ],
  },
  {
    plan: Plan.PRO,
    name: "Pro",
    tagline: "Power sharing, analytics & AI.",
    monthly: 12,
    annual: 10,
    cta: "Upgrade to Pro",
    highlighted: true,
    features: [
      "Everything in Free, plus:",
      "Custom branding on share pages",
      "Password-protected & expiring links",
      "Full engagement analytics",
      "Folders to organize your library",
      "300 AI transcript minutes / mo",
      "Optional Recio-hosted storage",
    ],
  },
  {
    plan: Plan.BUSINESS,
    name: "Business",
    tagline: "For teams that record together.",
    monthly: 20,
    annual: 17,
    perSeat: true,
    cta: "Upgrade to Business",
    features: [
      "Everything in Pro, plus:",
      "Shared team workspace & library",
      "Roles, permissions & SSO",
      "1,000 pooled AI minutes / mo",
      "Engagement webhooks & API",
      "Priority support",
    ],
  },
];

export function Pricing() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upgrade(plan: Plan) {
    if (!user) {
      navigate("/register");
      return;
    }
    setBusy(true);
    try {
      const { url } = await api.startCheckout({
        plan: plan as "PRO" | "BUSINESS",
        interval: annual ? "annual" : "monthly",
      });
      window.location.href = url; // hosted Stripe Checkout
    } catch (err) {
      // Billing not configured yet (or any failure) → graceful notice.
      setNotice(
        err instanceof ApiError && err.code !== "INTERNAL_ERROR"
          ? err.message
          : "Payments aren't switched on yet — they're coming very soon.",
      );
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6">
        <Link to={user ? "/dashboard" : "/"} className="text-sm text-muted hover:text-text-primary">
          ← Back
        </Link>
      </div>
      <header className="text-center">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-highlight">
          <Logo width={20} height={20} />
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Simple, honest pricing</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          Recording is free forever — it saves to your own cloud. Upgrade for sharing power, analytics, AI, and team features.
        </p>

        {/* Billing period toggle */}
        <div className="mt-6 inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm">
          <PeriodButton active={!annual} onClick={() => setAnnual(false)}>Monthly</PeriodButton>
          <PeriodButton active={annual} onClick={() => setAnnual(true)}>
            Annual <span className="ml-1 rounded-full bg-highlight px-1.5 py-0.5 text-[10px] font-semibold text-[#0A0A0A]">save ~17%</span>
          </PeriodButton>
        </div>
      </header>

      {notice && (
        <div className="mx-auto mt-6 max-w-md rounded-xl border border-border bg-card px-4 py-3 text-center text-sm text-text-primary shadow-sm">
          {notice}
        </div>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {TIERS.map((tier) => {
          const price = annual ? tier.annual : tier.monthly;
          const isCurrent = user?.plan === tier.plan;
          return (
            <div
              key={tier.plan}
              className={clsx(
                "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm",
                tier.highlighted ? "border-accent ring-1 ring-accent" : "border-border",
              )}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-highlight px-3 py-0.5 text-xs font-semibold text-[#0A0A0A]">
                  Most popular
                </span>
              )}
              <h2 className="text-lg font-semibold">{tier.name}</h2>
              <p className="mt-1 text-sm text-muted">{tier.tagline}</p>

              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">${price}</span>
                {tier.monthly > 0 && (
                  <span className="text-sm text-muted">/{tier.perSeat ? "seat·mo" : "mo"}</span>
                )}
              </div>
              <p className="mt-1 h-4 text-[11px] text-muted">
                {tier.monthly > 0 && annual ? "billed annually" : tier.monthly > 0 ? "billed monthly" : "free forever"}
              </p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {tier.features.map((f, i) => (
                  <li key={f} className={clsx("flex gap-2 text-sm", i === 0 && tier.plan !== Plan.FREE ? "font-medium text-text-primary" : "text-text-primary")}>
                    {!(i === 0 && tier.plan !== Plan.FREE) && (
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-highlight text-[#0A0A0A]">
                        <CheckIcon width={11} height={11} />
                      </span>
                    )}
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                {isCurrent ? (
                  <Button variant="secondary" className="w-full" disabled>
                    Current plan
                  </Button>
                ) : tier.plan === Plan.FREE ? (
                  user ? (
                    <Button variant="secondary" className="w-full" disabled>
                      Included
                    </Button>
                  ) : (
                    <Link to="/register" className="block">
                      <Button variant="secondary" className="w-full">{tier.cta}</Button>
                    </Link>
                  )
                ) : (
                  <Button
                    variant={tier.highlighted ? "highlight" : "primary"}
                    className="w-full"
                    disabled={busy}
                    onClick={() => void upgrade(tier.plan)}
                  >
                    {tier.cta}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        Prices in USD. Cancel anytime. Recording always stays free on your own cloud.
      </p>
    </div>
  );
}

function PeriodButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-accent text-white" : "text-muted hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}
