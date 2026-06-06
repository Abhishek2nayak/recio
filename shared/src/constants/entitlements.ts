/**
 * The single source of truth for "what can this plan do".
 *
 * Consumed by BOTH the server (to enforce, via `requireEntitlement`) and the clients
 * (to disable/badge locked controls and route to the upgrade flow). Client gating is
 * UX only — the server always re-checks. Keeping the matrix here means the two can
 * never drift.
 *
 * Pricing rationale lives in `docs/monetization.md`. Recio stores in the user's own
 * cloud, so we deliberately do NOT gate raw storage or video length — creation is
 * free; we gate collaboration, share-power, AI, analytics, and team features.
 */
import { Plan } from "./enums.js";

export interface Entitlements {
  /** Hard cap on lifetime recordings; `null` = unlimited. */
  maxRecordings: number | null;
  /** Hard cap on lifetime screenshots; `null` = unlimited. */
  maxScreenshots: number | null;
  /** Remove Recio branding / add a custom logo on share pages. */
  customBranding: boolean;
  /** Password-protect a share link. */
  passwordLinks: boolean;
  /** Set link expiry / disable viewer download. */
  linkControls: boolean;
  /** Full engagement analytics (viewer identity, % watched) vs. a bare view count. */
  fullAnalytics: boolean;
  /** Organize the library into folders. */
  folders: boolean;
  /** AI transcript + summary minutes included per period (0 = none; overage metered). */
  aiMinutesIncluded: number;
  /** Fair-use cap on bytes streamed through our playback proxy per month, in GB.
   *  `null` = unlimited. Protects margins (the proxy is our one real bandwidth cost). */
  monthlyStreamGb: number | null;
  /** Opt into Recio-hosted (FLOWCAP) storage instead of bring-your-own-cloud. */
  hostedStorage: boolean;
  /** Shared team workspace, roles, SSO, admin, API/webhooks. */
  team: boolean;
}

export const ENTITLEMENTS: Record<Plan, Entitlements> = {
  FREE: {
    maxRecordings: null, // unlimited — it's the user's own Drive
    maxScreenshots: null,
    customBranding: false,
    passwordLinks: false,
    linkControls: false,
    fullAnalytics: false,
    folders: false,
    aiMinutesIncluded: 5, // trial taste of AI
    monthlyStreamGb: 25, // generous fair-use; only bites on heavy/viral use
    hostedStorage: false,
    team: false,
  },
  PRO: {
    maxRecordings: null,
    maxScreenshots: null,
    customBranding: true,
    passwordLinks: true,
    linkControls: true,
    fullAnalytics: true,
    folders: true,
    aiMinutesIncluded: 300,
    monthlyStreamGb: 250,
    hostedStorage: true,
    team: false,
  },
  BUSINESS: {
    maxRecordings: null,
    maxScreenshots: null,
    customBranding: true,
    passwordLinks: true,
    linkControls: true,
    fullAnalytics: true,
    folders: true,
    aiMinutesIncluded: 1000, // pooled across the team
    monthlyStreamGb: null, // unlimited
    hostedStorage: true,
    team: true,
  },
};

/** Boolean capability keys (excludes the numeric/`null` ones) — handy for gates. */
export type BooleanEntitlement = {
  [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never;
}[keyof Entitlements];

/** Resolve the capability set for a plan. */
export function entitlementsFor(plan: Plan): Entitlements {
  return ENTITLEMENTS[plan];
}

/** Does this plan have a given boolean capability? */
export function can(plan: Plan, capability: BooleanEntitlement): boolean {
  return ENTITLEMENTS[plan][capability];
}
