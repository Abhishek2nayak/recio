/**
 * Stripe billing. The whole module is inert until STRIPE_SECRET_KEY is set
 * (`billingEnabled()`), so the app builds and runs with no Stripe account.
 *
 * The webhook is the ONLY writer of `User.plan` — client "success" redirects are
 * cosmetic. Events are idempotent via the WebhookEvent table (Stripe redelivers).
 */
import Stripe from "stripe";
import { ErrorCode, Plan } from "@flowcap/shared";
import type { SubStatus } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";

export type Interval = "monthly" | "annual";
export type PaidPlan = "PRO" | "BUSINESS";

let client: Stripe | null = null;

export function billingEnabled(): boolean {
  return env.STRIPE_SECRET_KEY.length > 0;
}

function stripe(): Stripe {
  if (!billingEnabled()) {
    throw new HttpError(ErrorCode.INTERNAL_ERROR, "Billing isn't enabled yet.");
  }
  if (!client) client = new Stripe(env.STRIPE_SECRET_KEY);
  return client;
}

/** Map a (plan, interval) to its configured Stripe price id. */
function priceIdFor(plan: PaidPlan, interval: Interval): string {
  const map: Record<PaidPlan, Record<Interval, string>> = {
    PRO: { monthly: env.STRIPE_PRICE_PRO_MONTHLY, annual: env.STRIPE_PRICE_PRO_ANNUAL },
    BUSINESS: { monthly: env.STRIPE_PRICE_BUSINESS_MONTHLY, annual: env.STRIPE_PRICE_BUSINESS_ANNUAL },
  };
  return map[plan][interval];
}

/** Reverse a Stripe price id back to a plan (for webhook sync). */
function planForPriceId(priceId: string): Plan {
  if (priceId && (priceId === env.STRIPE_PRICE_PRO_MONTHLY || priceId === env.STRIPE_PRICE_PRO_ANNUAL)) {
    return Plan.PRO;
  }
  if (
    priceId &&
    (priceId === env.STRIPE_PRICE_BUSINESS_MONTHLY || priceId === env.STRIPE_PRICE_BUSINESS_ANNUAL)
  ) {
    return Plan.BUSINESS;
  }
  return Plan.FREE;
}

function mapStatus(s: Stripe.Subscription.Status): SubStatus {
  switch (s) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    default:
      return "INCOMPLETE";
  }
}

/** Create a Checkout Session for a plan and return its hosted URL. */
export async function createCheckout(userId: string, plan: PaidPlan, interval: Interval): Promise<string> {
  const price = priceIdFor(plan, interval);
  if (!price) throw new HttpError(ErrorCode.INTERNAL_ERROR, "That plan isn't configured for checkout.");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw HttpError.unauthenticated();

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: userId,
    allow_promotion_codes: true,
    success_url: `${env.WEB_ORIGIN}/settings?billing=success`,
    cancel_url: `${env.WEB_ORIGIN}/pricing`,
  });
  if (!session.url) throw new HttpError(ErrorCode.INTERNAL_ERROR, "Stripe returned no checkout URL.");
  return session.url;
}

/** Create a Billing Portal session so the user can manage/cancel their subscription. */
export async function createPortal(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) {
    throw new HttpError(ErrorCode.NOT_FOUND, "No billing account yet — start a subscription first.");
  }
  const session = await stripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${env.WEB_ORIGIN}/settings`,
  });
  return session.url;
}

/** Verify + process a webhook. The only place subscriptions/plans are written. */
export async function handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
  const event = stripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);

  // Idempotency: Stripe redelivers, so process each event id once.
  const seen = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (seen) return;
  await prisma.webhookEvent.create({ data: { id: event.id } });

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = s.client_reference_id;
      if (userId && s.subscription) {
        const sub = await stripe().subscriptions.retrieve(s.subscription as string);
        await syncSubscription(userId, sub);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const user = await prisma.user.findFirst({ where: { stripeCustomerId: sub.customer as string } });
      if (user) await syncSubscription(user.id, sub);
      break;
    }
    default:
      break; // ignore the rest for now
  }
}

/** Mirror a Stripe subscription into our DB + flip the denormalized User.plan. */
async function syncSubscription(userId: string, sub: Stripe.Subscription): Promise<void> {
  const priceId = sub.items.data[0]?.price.id ?? "";
  const plan = planForPriceId(priceId);
  const status = mapStatus(sub.status);
  const live = sub.status === "active" || sub.status === "trialing";
  const periodEnd = new Date((sub.items.data[0]?.current_period_end ?? 0) * 1000);

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      plan,
      status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    update: {
      stripeSubscriptionId: sub.id,
      stripePriceId: priceId,
      plan,
      status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });

  // Active/trialing → grant the plan; anything else (canceled/past_due) → Free.
  await prisma.user.update({
    where: { id: userId },
    data: { plan: live ? plan : Plan.FREE, stripeCustomerId: sub.customer as string },
  });
}
