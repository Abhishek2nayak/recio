/**
 * Billing endpoints.
 *
 *   POST /billing/checkout   start a Stripe Checkout       [auth]
 *   POST /billing/portal     open the Stripe Billing Portal [auth]
 *   POST /billing/webhook    Stripe events (raw body)       [public, signature-verified]
 *
 * The webhook handler is exported separately so it can be mounted with a RAW body
 * parser BEFORE express.json() (Stripe signature verification needs the exact bytes).
 */
import { Router, type RequestHandler } from "express";
import { checkoutSchema, ok, type CheckoutInput } from "@flowcap/shared";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { billingEnabled, createCheckout, createPortal, handleWebhook } from "../services/billing-service.js";

export const billingRouter: Router = Router();
billingRouter.use(requireAuth);

billingRouter.post(
  "/checkout",
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    const { plan, interval } = req.body as CheckoutInput;
    const url = await createCheckout(getUserId(req), plan, interval);
    res.json(ok({ url }));
  }),
);

billingRouter.post(
  "/portal",
  asyncHandler(async (req, res) => {
    const url = await createPortal(getUserId(req));
    res.json(ok({ url }));
  }),
);

/** Raw-body Stripe webhook (mount before express.json in app.ts). */
export const billingWebhookHandler: RequestHandler = (req, res) => {
  if (!billingEnabled()) {
    res.status(503).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Billing disabled." } });
    return;
  }
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).send("Missing stripe-signature header.");
    return;
  }
  handleWebhook(req.body as Buffer, signature)
    .then(() => res.json({ received: true }))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Webhook error";
      // eslint-disable-next-line no-console
      console.error("[Vyooom] Stripe webhook error:", message);
      res.status(400).send(`Webhook error: ${message}`);
    });
};
