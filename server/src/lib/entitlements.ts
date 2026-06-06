/**
 * Server-side entitlement resolution. Normally a plan's entitlements come straight
 * from the shared matrix, but the `UNLOCK_ALL_FEATURES` test flag promotes everyone to
 * full (Business) entitlements so Pro/Business features can be tested without paying.
 *
 * All server gates (DTO, requireEntitlement, share branding, analytics, usage cap)
 * go through here so the flag flips everything consistently — UI included, since the
 * resolved entitlements ship on the UserDTO.
 */
import { ENTITLEMENTS, entitlementsFor, type BooleanEntitlement, type Entitlements, type Plan } from "@flowcap/shared";
import { env } from "../config/env.js";

export function resolveEntitlements(plan: Plan): Entitlements {
  return env.UNLOCK_ALL_FEATURES ? ENTITLEMENTS.BUSINESS : entitlementsFor(plan);
}

export function canFeature(plan: Plan, capability: BooleanEntitlement): boolean {
  return resolveEntitlements(plan)[capability];
}
