/**
 * Link-preview route: GET /s/:token
 *
 * The canonical share URL points here (see `buildShareUrl`). Crawlers (Slack,
 * Teams, iMessage, Gmail, Twitter) read the Open Graph tags — per-video title,
 * owner, duration, and poster image — so a pasted Vyooom link unfurls like a video,
 * not a generic site card. Humans are redirected instantly to the SPA share page.
 *
 * The SPA route (`WEB_ORIGIN/s/:token`) keeps working for direct visits; this page
 * is just the preview-capable front door.
 */
import { Router } from "express";
import { formatDuration } from "@flowcap/shared";
import { env } from "../config/env.js";
import { param } from "../lib/params.js";
import { asyncHandler } from "../middleware/error.js";
import { findByShareToken } from "../services/media-service.js";
import { getShareByToken, isShareLive } from "../services/share-service.js";

export const previewRouter: Router = Router();

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

previewRouter.get(
  "/:token",
  asyncHandler(async (req, res) => {
    const token = param(req, "token");
    const target = `${env.WEB_ORIGIN}/s/${encodeURIComponent(token)}`;

    const result = await findByShareToken(token);
    const share = result ? await getShareByToken(token) : null;
    const live = result?.media.isPublic && isShareLive(share);

    // Private/expired/unknown links still redirect — the SPA shows the right notice
    // — but expose no metadata to crawlers.
    let meta = "";
    if (result && live) {
      const { media, type } = result;
      const isRecording = type === "RECORDING";
      const duration = isRecording && "duration" in media ? media.duration : 0;
      const bits = [
        isRecording && duration ? `▶ ${formatDuration(duration)}` : null,
        "watch on Vyooom",
      ].filter(Boolean);
      const description = bits.join(" · ");
      const image = media.thumbnailUrl ? `${env.API_PUBLIC_URL}/share/${token}/thumb` : null;

      meta = [
        `<title>${esc(media.title)}</title>`,
        `<meta property="og:type" content="${isRecording ? "video.other" : "website"}" />`,
        `<meta property="og:site_name" content="Vyooom" />`,
        `<meta property="og:title" content="${esc(media.title)}" />`,
        `<meta property="og:description" content="${esc(description)}" />`,
        `<meta property="og:url" content="${esc(target)}" />`,
        image ? `<meta property="og:image" content="${esc(image)}" />` : "",
        `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
        `<meta name="twitter:title" content="${esc(media.title)}" />`,
        image ? `<meta name="twitter:image" content="${esc(image)}" />` : "",
      ]
        .filter(Boolean)
        .join("\n    ");
    } else {
      meta = `<title>Vyooom</title>`;
    }

    res
      .status(200)
      .type("html")
      .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    ${meta}
    <link rel="canonical" href="${esc(target)}" />
    <meta http-equiv="refresh" content="0;url=${esc(target)}" />
  </head>
  <body>
    <script>location.replace(${JSON.stringify(target)});</script>
    <p>Watch this on <a href="${esc(target)}">Vyooom</a>.</p>
  </body>
</html>`);
  }),
);
