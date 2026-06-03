/**
 * Typed path-param accessor. Under `noUncheckedIndexedAccess` `req.params.x` is
 * `string | undefined`; this narrows it to `string` (or fails with a clear 400),
 * so handlers don't litter non-null assertions.
 */
import type { Request } from "express";
import { HttpError } from "./http-error.js";

export function param(req: Request, key: string): string {
  const value = req.params[key];
  if (value === undefined) throw HttpError.badRequest(`Missing path parameter: ${key}`);
  return value;
}
