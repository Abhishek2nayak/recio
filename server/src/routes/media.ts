/**
 * Range-capable media streaming proxy.
 *
 *   GET /media/:id/stream?t=<playbackToken>   [public — authorized by the token]
 *
 * Backs playback for Drive-stored items: we stream the ORIGINAL bytes (forwarding
 * the browser's Range header so it can seek) instead of embedding Drive's preview
 * iframe, whose transcoder is unreliable for MediaRecorder webm. The query token is
 * minted server-side (see `getPlaybackUrl`) and scoped to a single media id, so it
 * works equally for the owner's dashboard and a public share — without the <video>
 * element needing an Authorization header.
 */
import { Router } from "express";
import { asyncHandler } from "../middleware/error.js";
import { param } from "../lib/params.js";
import { HttpError } from "../lib/http-error.js";
import { verifyPlaybackToken } from "../lib/jwt.js";
import { findOwnedMediaById } from "../services/media-service.js";
import { streamMedia } from "../services/storage-service.js";

export const mediaRouter: Router = Router();

mediaRouter.get(
  "/:id/stream",
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const raw = typeof req.query.t === "string" ? req.query.t : "";

    let token;
    try {
      token = verifyPlaybackToken(raw);
    } catch {
      throw HttpError.unauthenticated("Invalid or expired playback token.");
    }
    if (token.mid !== id) throw HttpError.forbidden("Token does not match this media.");

    const media = await findOwnedMediaById(token.sub, id);
    if (!media) throw HttpError.notFound("Media not found.");

    const { stream, status, headers } = await streamMedia(
      token.sub,
      media.storageProvider,
      media.storageFileId,
      req.headers.range,
    );

    res.status(status);
    // The web app is a different origin (:5173) from this API (:4000); helmet's
    // default CORP would block the <video> from loading these bytes.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);

    stream.on("error", () => {
      if (!res.headersSent) res.status(502);
      res.end();
    });
    // Abort the upstream Drive read if the client disconnects mid-stream (seek/close).
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  }),
);
