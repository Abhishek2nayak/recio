/**
 * Validated environment config. The process refuses to boot if anything required
 * is missing or malformed — no scattered `process.env.X!` reads, no silent defaults
 * for secrets. Env is injected via `dotenv-cli -e ../.env` (see package scripts).
 */
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  // Public origin of THIS API server — used to build absolute media-stream URLs
  // that the browser's <video>/<img> elements load directly.
  API_PUBLIC_URL: z.string().url().default("http://localhost:4000"),

  DATABASE_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  // Must decode to exactly 32 bytes for AES-256.
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)"),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url(),

  // Dropbox is optional — the server boots without it; the Dropbox path just stays
  // inert until an app key/secret are configured.
  DROPBOX_CLIENT_ID: z.string().default(""),
  DROPBOX_CLIENT_SECRET: z.string().default(""),
  DROPBOX_OAUTH_REDIRECT_URI: z.string().default("http://localhost:4000/storage/dropbox/callback"),

  // Supabase Storage backs the "Save to Recio" path. The service-role key stays
  // server-side; clients upload via short-lived signed upload URLs the server mints.
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().default("flowcap-media"),

  SIGNED_URL_TTL: z.coerce.number().int().positive().default(3600),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  // eslint-disable-next-line no-console
  console.error(`\n✖ Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
