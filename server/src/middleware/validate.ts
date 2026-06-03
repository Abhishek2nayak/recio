/**
 * Zod validation middleware. Parses and REPLACES the chosen request part with the
 * typed, coerced result, so handlers read already-validated data. ZodErrors are
 * turned into the structured 422 envelope by the error middleware.
 */
import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";

type Part = "body" | "query" | "params";

export function validate(schema: ZodSchema, part: Part = "body"): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.parse(req[part]);
    // req.query/params have read-only-ish typings; assign through a cast.
    (req as unknown as Record<Part, unknown>)[part] = parsed;
    next();
  };
}
