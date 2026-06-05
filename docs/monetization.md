# Recio — Monetization & Subscription Architecture

> Status: proposal / decision doc. Nothing here is built yet except the `Plan` enum
> (`FREE | PRO`) on `User` and the scaffolded `PLAN_LIMITS` in
> `shared/src/constants/limits.ts`, which the server computes but does **not** enforce.

---

## 1. TL;DR recommendation

1. **Billing engine: Stripe, subscription (seat/flat) based — not usage-based as the
   primary model.** Use Stripe Checkout + Customer Billing Portal + webhooks. Add
   *metered usage only as a secondary lever* for the two things that actually cost us
   money (AI minutes, proxy egress). Rationale in §6.
2. **Do NOT gate raw storage or video length on the free tier.** Recio stores in the
   user's *own* Google Drive, so storage is effectively free to us. "Unlimited
   recordings, stored on your own Drive" should be the **free-tier headline and our
   wedge against Loom**. Gate on collaboration, share-power features, AI, analytics,
   and team/admin instead (§2, §5).
3. **Introduce a third tier.** `FREE → PRO → BUSINESS` (team). The `Plan` enum today
   only has FREE/PRO; add BUSINESS. (§4)
4. **Add a `Subscription` table + a single shared `entitlements` module** that maps a
   plan → capabilities, and enforce it in one Express middleware + a few feature
   checks. Don't scatter `if (plan === ...)` through the codebase. (§8, §9)

---

## 2. Why Recio's economics are different from Loom (read this first)

Loom **hosts** every video: they pay for object storage, transcoding, and — the big
one — **CDN egress** every time a video is viewed. So Loom's pricing exists largely to
cover hosting, and they gate the things that cost them money: video count (25 on free),
video length (5 min on free), storage.

**Recio's model inverts this.** Uploads go straight from the browser into the user's
own Drive/Dropbox; the heavy bytes never touch us on the way in (see
`drive-service.ts` — we only open a resumable session and hand the client the URI).
That means:

- **Storage is the user's cost, not ours.** Gating storage/length would throw away our
  single biggest differentiator. Lead with *"unlimited, on your cloud."*
- **We have almost no infra cost per recording created.** The marginal cost of a free
  user is near zero — which makes a generous free tier cheap to offer.

But there is **one real, growing cost we just introduced**: the **streaming proxy**
(`server/src/routes/media.ts`). To make Drive webm play reliably, viewers now stream
bytes *through our server*. That is **egress we pay for**, and it scales with *views*,
not uploads. This is the cost driver to watch and, eventually, to meter/gate. See §3
and §10.

---

## 3. What actually costs us money (the cost model to price against)

| Cost driver | Scales with | Magnitude | Pricing implication |
|---|---|---|---|
| **Proxy egress** (media.ts streaming Drive bytes) | **views** × filesize | Moderate→high if a video goes viral | Meter it; consider serving free-tier public views via Drive's own link, paid via proxy (§10) |
| **AI features** (transcripts, summaries) | minutes transcribed | Real per-minute cost (e.g. ASR) | Pro-gated + metered minutes; classic usage add-on |
| **Recio-hosted storage** (`FLOWCAP`/Supabase) | bytes stored + egress | Real | This is the *paid alternative* to BYO-cloud; charge for it |
| **Postgres + app servers** | users, metadata | Low | Fixed overhead |
| **Stripe fees** | revenue | 2.9% + 30¢ | Favor fewer, larger charges (annual plans) |

The headline: **our costs scale with *consumption* (views, AI minutes, hosted GB), not
with *creation*.** So the pricing should let creation be free/cheap and charge for
consumption-heavy and team/power features.

---

## 4. Proposed tiers

Add `BUSINESS` to the `Plan` enum. Suggested starting prices (validate later):

| | **Free** | **Pro** — $12/mo ($10 annual) | **Business** — $20/user/mo |
|---|---|---|---|
| Recordings / screenshots | **Unlimited** (on your Drive) | Unlimited | Unlimited |
| Storage | Your own Drive/Dropbox | Your cloud **+ optional Recio hosting** | Same + pooled team hosting |
| Max video length | Unlimited | Unlimited | Unlimited |
| Reliable playback proxy | ✅ (fair-use view cap, §10) | ✅ higher cap | ✅ highest |
| Share links | ✅ public / private | ✅ | ✅ |
| **Password-protected links** | — | ✅ | ✅ |
| **Link expiry / disable download** | — | ✅ | ✅ |
| **Custom branding** (logo, remove "Recio") | — | ✅ | ✅ |
| **Custom CTAs / embedded buttons** | — | ✅ | ✅ |
| **Engagement analytics** (who watched, % viewed) | basic view count | ✅ full | ✅ full + export |
| **AI transcript + summary** | trial minutes | ✅ N min/mo, then metered | ✅ pooled minutes |
| Comments & reactions | ✅ | ✅ | ✅ |
| **Workspaces / folders** | personal only | ✅ folders | ✅ shared team library |
| **Team management / SSO / roles** | — | — | ✅ |
| Engagement webhooks / API | — | — | ✅ |

Free is intentionally fat on *creation* and thin on *power/collaboration/AI* — the
features whose value (and cost) is real. This is the standard PLG funnel: hook on
free creation, convert on sharing power + team needs.

---

## 5. Gating philosophy — what's free vs paid, and why

**Keep free (cheap to us, drives acquisition & virality):**
- Unlimited recording/screenshots to the user's own cloud.
- Basic public/private sharing (we already built per-file ACL control).
- Comments/reactions — these make shared links spread (viral loop). Don't tax them.
- Basic view count.

**Gate behind Pro (high perceived value, low marginal cost to us):**
- Branding removal, custom CTAs, password links, expiry, download control.
- Full analytics (engagement graph, viewer identity).
- Folders.

**Gate behind Pro/Business AND meter (real marginal cost):**
- AI transcripts/summaries (per-minute ASR cost).
- Recio-hosted storage (`FLOWCAP`) as a turnkey alternative to BYO-cloud.
- Proxy egress above a fair-use cap.

**Gate behind Business (team buyer):**
- Shared workspace library, roles/permissions, SSO, admin, API/webhooks, pooled
  storage & AI.

---

## 6. Stripe vs usage-based: recommendation

**Primary model: Stripe recurring subscriptions (flat for Pro, per-seat for Business).**
Reasons:
- Predictable revenue and predictable bills for users → higher conversion than usage
  meters, which create "bill anxiety."
- Our biggest value props (branding, analytics, team) are **capability** gates, which
  map cleanly to flat tiers.
- Per-seat is the proven model for the Business/team buyer and scales ARPU with the
  account.

**Secondary model: metered add-ons** (Stripe usage-based prices) for the two genuine
cost drivers:
- **AI minutes** beyond the plan's included pool.
- **Recio-hosted GB** (only for users who opt into hosting instead of BYO-cloud).

Avoid making the *core* product usage-priced. Use Stripe's
[metered/graduated prices](https://docs.stripe.com/billing/subscriptions/usage-based)
only for those overflow meters, reported via the Meter Events API (§10).

---

## 7. Stripe integration architecture

```
                ┌─────────────┐   1. POST /billing/checkout            ┌──────────┐
   Web app ────▶│  Recio API  │───────────────────────────────────────▶│  Stripe  │
   (Pro CTA)    │             │   creates Checkout Session (mode=sub)   │ Checkout │
                └─────────────┘◀──────────────────────────────────────┘└────┬─────┘
                       ▲          returns session.url (redirect)             │
                       │                                                      │ user pays
                       │  4. webhook: checkout.session.completed,             ▼
                       │     customer.subscription.{created,updated,deleted}, 
                       │     invoice.paid / payment_failed              ┌──────────┐
                       └────────────────────────────────────────────────│  Stripe  │
                          POST /billing/webhook (signature-verified)     │  events  │
                                                                          └──────────┘
   Manage/cancel:  POST /billing/portal → Stripe Billing Portal session → redirect
```

**Endpoints (new `server/src/routes/billing.ts`):**

- `POST /billing/checkout` *(auth)* — body `{ plan: "PRO" | "BUSINESS", interval }`.
  Ensures a Stripe Customer exists for the user (create + persist `stripeCustomerId`
  on first call), creates a Checkout Session with the right Price ID and
  `client_reference_id = userId`, returns `{ url }`.
- `POST /billing/portal` *(auth)* — creates a Billing Portal session for the user's
  customer; returns `{ url }`. This offloads card updates, plan changes, cancellation,
  and invoice history to Stripe (don't build these ourselves).
- `POST /billing/webhook` *(public, raw body, signature-verified)* — the **source of
  truth** for entitlements. Never trust the client's "I paid" — flip `plan` only here.

**Webhook → DB mapping (the only place `plan` changes):**

| Stripe event | Action |
|---|---|
| `checkout.session.completed` | link `stripeCustomerId`/`stripeSubscriptionId`; set status |
| `customer.subscription.created/updated` | upsert `Subscription`; set `User.plan` from the price's plan; store `currentPeriodEnd`, `cancelAtPeriodEnd`, `status` |
| `customer.subscription.deleted` | downgrade `User.plan = FREE` |
| `invoice.paid` | mark active; reset monthly usage counters (§10) |
| `invoice.payment_failed` | mark `past_due`; start dunning (Stripe handles emails) |

**Hard rules:**
- Webhook handler must run on the **raw body** (Stripe signature) — mount it *before*
  `express.json()` (see `app.ts`), or use `express.raw()` for that route only.
- **Idempotency**: store processed `event.id`s (a `WebhookEvent` table or a Redis set);
  Stripe redelivers. Make all handlers idempotent.
- Map **Price IDs → Plan** in config/env, not hardcoded, so test/live differ cleanly.

---

## 8. Schema changes

Add a `Subscription` model and a few `User` fields. Plan stays on `User` as the
**denormalized, fast-read entitlement** (every request reads it); `Subscription` holds
the billing truth.

```prisma
enum Plan {
  FREE
  PRO
  BUSINESS        // NEW
}

enum SubStatus {   // mirrors Stripe subscription.status
  ACTIVE
  TRIALING
  PAST_DUE
  CANCELED
  INCOMPLETE
}

model User {
  // ...existing...
  plan             Plan    @default(FREE)   // denormalized for fast entitlement reads
  stripeCustomerId String? @unique          // NEW
  subscription     Subscription?            // NEW
}

model Subscription {
  id                   String    @id @default(cuid())
  userId               String    @unique
  stripeSubscriptionId String    @unique
  stripePriceId        String
  plan                 Plan
  status               SubStatus
  seats                Int       @default(1)   // Business per-seat
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean   @default(false)
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// Idempotency guard for webhook redelivery.
model WebhookEvent {
  id          String   @id            // Stripe event id
  processedAt DateTime @default(now())
}

// Monthly usage meters for the metered add-ons (reset on invoice.paid).
model UsageCounter {
  id            String   @id @default(cuid())
  userId        String
  periodStart   DateTime
  aiMinutes     Int      @default(0)   // transcription minutes consumed
  proxyBytes    BigInt   @default(0)   // streamed via media.ts proxy
  hostedBytes   BigInt   @default(0)   // bytes in Recio-hosted storage
  @@unique([userId, periodStart])
  @@index([userId])
}
```

**Team note:** for `BUSINESS`, model a `Workspace`/`Membership` later so a subscription
covers many users; for v1 a Business plan can be single-account with `seats` as a
soft cap. Don't block launch on full team modeling.

---

## 9. Entitlement enforcement architecture

One shared module, consumed by both server (enforcement) and web/extension (UI gating
& upsell). Put the capability matrix in `shared` so client and server never drift.

```ts
// shared/src/constants/entitlements.ts
export interface Entitlements {
  maxRecordings: number | null;     // null = unlimited
  customBranding: boolean;
  passwordLinks: boolean;
  linkExpiry: boolean;
  fullAnalytics: boolean;
  folders: boolean;
  aiMinutesIncluded: number;        // 0 = none, then metered
  hostedStorage: boolean;
  team: boolean;
}

export const ENTITLEMENTS: Record<Plan, Entitlements> = {
  FREE:     { maxRecordings: null, customBranding: false, passwordLinks: false,
              linkExpiry: false, fullAnalytics: false, folders: false,
              aiMinutesIncluded: 5, hostedStorage: false, team: false },
  PRO:      { maxRecordings: null, customBranding: true, passwordLinks: true,
              linkExpiry: true, fullAnalytics: true, folders: true,
              aiMinutesIncluded: 300, hostedStorage: true, team: false },
  BUSINESS: { /* PRO + */ team: true, /* pooled minutes */ aiMinutesIncluded: 1000,
              maxRecordings: null, customBranding: true, passwordLinks: true,
              linkExpiry: true, fullAnalytics: true, folders: true, hostedStorage: true },
};
```

**Server enforcement (one helper + a middleware factory):**

```ts
// server/src/middleware/entitlement.ts
export function requireEntitlement(cap: keyof Entitlements): RequestHandler {
  return async (req, _res, next) => {
    const user = await getUser(getUserId(req));      // plan read off User row
    if (!ENTITLEMENTS[user.plan][cap]) {
      throw new HttpError(ErrorCode.UPGRADE_REQUIRED, "This feature needs a Pro plan.");
    }
    next();
  };
}
```

Apply it surgically, e.g. on `share` (password/expiry params), AI routes, branding
settings. Add a single new error code `UPGRADE_REQUIRED` (HTTP 402 Payment Required) to
`shared/src/constants/errors.ts` so the web app can intercept it and show the upsell
modal uniformly.

**Client gating:** expose entitlements on the `UserDTO` (or a `GET /billing/me`
endpoint) so the UI can disable+badge locked controls and route to the upgrade flow.
**Always re-check on the server** — client gating is UX, not security.

Replace the dead `PLAN_LIMITS` scaffold by folding it into `ENTITLEMENTS` (or keep
`PLAN_LIMITS` as the numeric slice). Today `limits.ts` says limits are "computed but
not enforced" — this is where they finally get enforced.

---

## 10. Metering (the two real cost drivers)

**AI minutes:** when a transcript job runs, increment `UsageCounter.aiMinutes`. If over
`aiMinutesIncluded`, either block (cheap) or report a Stripe **meter event** for
overage billing. Reset on `invoice.paid`.

**Proxy egress:** the streaming proxy (`media.ts`) is the sleeper cost. Strategy:
- Track bytes streamed per owner per period (`UsageCounter.proxyBytes`) — increment by
  `Content-Length`/range size as we pipe.
- **Free tier**: enforce a fair-use monthly view/egress cap; above it, fall back to
  Drive's *own* `webContentLink`/preview (their bandwidth, not ours) or throttle.
- **Paid tiers**: higher/none cap, always served via the reliable proxy.
- This neatly aligns the one cost that scales with success (a viral video) to the
  paying customer, while keeping free users from costing us unboundedly.

---

## 11. Implementation phases

1. **Schema & entitlements (no Stripe yet).** Add `BUSINESS`, `Subscription`,
   `WebhookEvent`, `UsageCounter`; add `shared/entitlements.ts`; add `UPGRADE_REQUIRED`
   (402). Wire `requireEntitlement` on a couple of routes. Ship with everyone on FREE.
2. **Stripe plumbing.** Env for keys + Price IDs; `billing.ts` with checkout/portal;
   raw-body webhook with signature verify + idempotency; flip `plan` from webhooks only.
3. **Upgrade UX.** Pricing page, "Upgrade" CTAs on locked controls, `402`→upsell-modal
   interceptor in `web/src/lib/api.ts`, Billing tab in Settings (deep-link to portal).
4. **First paid features.** Ship 2–3 high-value Pro gates first (branding removal,
   password links, full analytics) so Pro is worth buying on day one.
5. **AI + metering.** Transcripts behind Pro with included minutes + overage meter;
   proxy-egress counter + free-tier fair-use cap.
6. **Business/team.** Workspaces, seats, roles, SSO.

---

## 12. Risks & edge cases

- **Webhook is the only writer of `plan`.** Client "success" redirects are cosmetic.
  Handle out-of-order/duplicate events (idempotency table). Test with Stripe CLI
  (`stripe listen`).
- **Downgrade behavior.** On cancel/downgrade, what happens to already-public branded
  links, folders, extra recordings? Decide: keep existing artifacts read-only but block
  *new* gated actions (least punitive, recommended) vs. revoke. Don't delete user data.
- **Proration & interval switches** — let the Stripe Billing Portal own these; don't
  hand-roll.
- **Dunning** — `past_due` should soft-degrade to FREE entitlements after the grace
  window, not instantly. Stripe Smart Retries + emails handle the nudging.
- **BYO-cloud quirk:** a user who disconnects Drive still has metadata rows; a paid
  branded link to a now-inaccessible Drive file should fail gracefully (already partly
  handled — playback proxy 502s; show a friendly "owner's storage is unavailable").
- **Tax/VAT** — enable Stripe Tax; don't compute tax yourself.
- **Refunds/chargebacks** — Billing Portal + Stripe dashboard; webhook on
  `charge.refunded` if you want to react.
- **Free-tier abuse** — since creation is free, the abuse vector is *egress*, which the
  §10 cap addresses; also rate-limit share creation.

---

## 13. Open decisions for you

1. Prices — are $12 Pro / $20-seat Business the right anchors for your market?
2. Is **Recio-hosted storage** a launch feature or later? (It's the one thing that
   turns us into a cost-bearing host like Loom — price it deliberately.)
3. AI: build in-house ASR vs. a provider (Deepgram/Whisper API)? Affects per-minute cost
   and therefore the included-minutes pool.
4. Team modeling depth for v1 (single-account Business vs. full Workspace/Membership).
5. Free-tier fair-use egress cap — what monthly number feels generous but safe?
