/**
 * Comments — public, time-stamped comments on a recording/screenshot.
 *
 *   GET  /comments/:resourceId   list (public)
 *   POST /comments               add a comment (optional auth)
 *
 * Authenticated users post under their account name; guests provide a name. Auth is
 * optional so viewers of a shared link can comment without an account.
 */
import { Router } from "express";
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
import { param } from "../lib/params.js";

export const commentsRouter: Router = Router();

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
