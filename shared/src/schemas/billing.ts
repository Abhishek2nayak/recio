import { z } from "zod";

/** Start a Stripe Checkout for a paid plan + billing interval. */
export const checkoutSchema = z.object({
  plan: z.enum(["PRO", "BUSINESS"]),
  interval: z.enum(["monthly", "annual"]),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
