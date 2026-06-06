/**
 * @flowcap/shared — the contract layer.
 *
 * Types, enums, error codes, Zod schemas, formatting utils, and design tokens
 * consumed by the server, web app, and extension. Importing from here keeps the
 * three surfaces from drifting on shapes, error codes, or the visual system.
 *
 * Design tokens are also available via the `@flowcap/shared/design` subpath.
 */

// constants
export * from "./constants/enums.js";
export * from "./constants/errors.js";
export * from "./constants/entitlements.js";
export * from "./constants/limits.js";
export * from "./constants/reactions.js";

// types
export * from "./types/api.js";
export * from "./types/models.js";

// schemas (Zod values + inferred types)
export * from "./schemas/analytics.js";
export * from "./schemas/auth.js";
export * from "./schemas/billing.js";
export * from "./schemas/branding.js";
export * from "./schemas/comment.js";
export * from "./schemas/media.js";
export * from "./schemas/reaction.js";
export * from "./schemas/share.js";
export * from "./schemas/storage.js";
export * from "./schemas/upload.js";

// utils
export * from "./utils/format.js";
export * from "./utils/api.js";

// design tokens (also exposed at @flowcap/shared/design)
export * from "./design/index.js";
