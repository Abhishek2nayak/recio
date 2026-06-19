/**
 * Comments — public, time-stamped comments on a recording/screenshot.
 *
 *   GET  /comments/:resourceId   list (public)
 *   POST /comments               add a comment (optional auth)
 *
 * Authenticated users post under their account name; guests provide a name. Auth is
 * optional so viewers of a shared link can comment without an account.
 */
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import {
  ErrorCode,
  createCommentSchema,
  ok,
  type CommentDTO,
  type CreateCommentInput,
} from "@flowcap/shared";
import type { Comment } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { HttpError } from "../lib/http-error.js";
import { asyncHandler } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { param } from "../lib/params.js";
import { createSignedUpload, createSignedDownloadUrl } from "../services/supabase-storage.js";

export const commentsRouter: Router = Router();

/* ── Comment attachments ──────────────────────────────────────────────────────
 * Authenticated users attach a file: we mint a signed upload URL (client PUTs the
 * bytes straight to storage), then resolve a long-lived signed download URL that
 * gets embedded in the comment body. No DB change; the server never sees the bytes.
 */
const ATTACH_TTL = 60 * 60 * 24 * 365; // 1 year

const signAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(200),
  contentType: z.string().trim().max(120).optional(),
});
const resolveAttachmentSchema = z.object({ path: z.string().trim().min(1).max(300) });

commentsRouter.post(
  "/attachment/sign",
  requireAuth,
  validate(signAttachmentSchema),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { filename } = req.body as z.infer<typeof signAttachmentSchema>;
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "file";
    const path = `${userId}/attachments/${randomUUID()}-${safe}`;
    const { signedUrl } = await createSignedUpload(path);
    res.json(ok({ uploadUrl: signedUrl, path }));
  }),
);

commentsRouter.post(
  "/attachment/resolve",
  requireAuth,
  validate(resolveAttachmentSchema),
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const { path } = req.body as z.infer<typeof resolveAttachmentSchema>;
    // Only let a user resolve their own uploaded attachments.
    if (!path.startsWith(`${userId}/attachments/`)) {
      throw new HttpError(ErrorCode.FORBIDDEN, "Not your attachment.");
    }
    const url = await createSignedDownloadUrl(path, ATTACH_TTL);
    res.json(ok({ url }));
  }),
);

function toCommentDTO(c: Comment): CommentDTO {
  return {
    id: c.id,
    authorName: c.authorName,
    body: c.body,
    timestampSec: c.timestampSec,
    createdAt: c.createdAt.toISOString(),
  };
}

/** Best-effort: returns the user id if a valid Bearer token is present, else null. */
function optionalUserId(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return verifyAccessToken(authHeader.slice(7).trim()).sub;
  } catch {
    return null;
  }
}

commentsRouter.get(
  "/:resourceId",
  asyncHandler(async (req, res) => {
    const comments = await prisma.comment.findMany({
      where: { resourceId: param(req, "resourceId") },
      orderBy: { createdAt: "asc" },
    });
    res.json(ok({ comments: comments.map(toCommentDTO) }));
  }),
);

commentsRouter.post(
  "/",
  validate(createCommentSchema),
  asyncHandler(async (req, res) => {
    const { resourceType, resourceId, body, timestampSec, authorName } = req.body as CreateCommentInput;

    const userId = optionalUserId(req.headers.authorization);
    let name = authorName?.trim() || "Guest";
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
      name = user?.name || user?.email?.split("@")[0] || "User";
    } else if (!authorName?.trim()) {
      throw new HttpError(ErrorCode.VALIDATION_ERROR, "A name is required to comment as a guest.");
    }

    const comment = await prisma.comment.create({
      data: {
        resourceType,
        resourceId,
        authorUserId: userId,
        authorName: name,
        body,
        timestampSec: timestampSec ?? null,
      },
    });
    res.status(201).json(ok({ comment: toCommentDTO(comment) }));
  }),
);
