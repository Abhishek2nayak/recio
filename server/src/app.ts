/**
 * Express app assembly. Security middleware → parsers → rate limit → routes →
 * 404 → central error handler. Storage/upload/share/media routers mount here in
 * the next checkpoint (the structure is ready for them).
 */
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { ok } from "@flowcap/shared";
import { env } from "./config/env.js";
import { apiLimiter } from "./middleware/rate-limit.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { storageRouter } from "./routes/storage.js";
import { uploadRouter } from "./routes/upload.js";
import { recordingsRouter } from "./routes/recordings.js";
import { mediaRouter } from "./routes/media.js";
import { screenshotsRouter } from "./routes/screenshots.js";
import { shareRouter } from "./routes/share.js";
import { reactionsRouter } from "./routes/reactions.js";
import { commentsRouter } from "./routes/comments.js";
import { analyticsRouter } from "./routes/analytics.js";
import { brandingRouter } from "./routes/branding.js";
import { billingRouter, billingWebhookHandler } from "./routes/billing.js";
import { workspacesRouter } from "./routes/workspaces.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true, // allow the refresh cookie
    }),
  );
  // Stripe webhook MUST see the raw body for signature verification — mount it
  // before the JSON parser. (It no-ops with 503 until billing is configured.)
  app.post("/billing/webhook", express.raw({ type: "application/json" }), billingWebhookHandler);

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  // Every response is dynamic + auth-scoped JSON (or a redirect). Never let a
  // browser/proxy cache it — avoids stale data after a rename/delete/visibility flip.
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  // Health check (unauthenticated, not rate limited).
  app.get("/health", (_req, res) => {
    res.json(ok({ status: "ok", uptime: process.uptime() }));
  });

  // Media streaming is mounted BEFORE the rate limiter: a single video generates
  // many Range requests (every seek), which would otherwise trip the per-IP limit.
  app.use("/media", mediaRouter);

  app.use("/", apiLimiter);
  app.use("/auth", authRouter);
  app.use("/storage", storageRouter);
  app.use("/upload", uploadRouter);
  app.use("/recordings", recordingsRouter);
  app.use("/screenshots", screenshotsRouter);
  app.use("/share", shareRouter);
  app.use("/reactions", reactionsRouter);
  app.use("/comments", commentsRouter);
  app.use("/analytics", analyticsRouter);
  app.use("/branding", brandingRouter);
  app.use("/billing", billingRouter);
  app.use("/workspaces", workspacesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
