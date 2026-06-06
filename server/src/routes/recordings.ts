/**
 * Recording metadata CRUD (the bytes already live in Drive/Supabase by now).
 *
 *   GET    /recordings        paginated dashboard list (filter/sort/search)
 *   POST   /recordings        create the metadata row after an upload
 *   GET    /recordings/:id     one recording (owner only)
 *   PATCH  /recordings/:id     rename / description / visibility (Drive ACL side-effect)
 *   DELETE /recordings/:id     soft delete (+ best-effort object removal)
 */
import { Router } from "express";
import {
  ok,
  ResourceType,
  createRecordingSchema,
  listMediaQuerySchema,
  updateMediaSchema,
  type CreateRecordingInput,
  type ListMediaQuery,
  type Paginated,
  type RecordingDTO,
  type UpdateMediaInput,
} from "@flowcap/shared";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { toRecordingDTO } from "../lib/dto.js";
import { HttpError } from "../lib/http-error.js";
import { param } from "../lib/params.js";
import { getPlaybackUrl } from "../services/storage-service.js";
import {
  createRecording,
  findOwnedRecording,
  findViewableRecording,
  listRecordings,
  listWorkspaceRecordings,
  softDeleteMedia,
  updateRecording,
} from "../services/media-service.js";
import { requireMember } from "../services/workspace-service.js";
import { generateTranscript, getTranscript } from "../services/ai-service.js";

export const recordingsRouter: Router = Router();

recordingsRouter.use(requireAuth);

recordingsRouter.get(
  "/",
  validate(listMediaQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListMediaQuery;
    let page;
    if (query.workspaceId) {
      await requireMember(getUserId(req), query.workspaceId); // 404s for non-members
      page = await listWorkspaceRecordings(query.workspaceId, query);
    } else {
      page = await listRecordings(getUserId(req), query);
    }
    const items = await Promise.all(
      page.items.map(async (r) => ({
        ...toRecordingDTO(r),
        previewUrl: await getPlaybackUrl(r.userId, r.storageProvider, r.storageFileId, r.id),
      })),
    );
    const body: Paginated<RecordingDTO> = { items, nextCursor: page.nextCursor };
    res.json(ok(body));
  }),
);

recordingsRouter.post(
  "/",
  validate(createRecordingSchema),
  asyncHandler(async (req, res) => {
    const recording = await createRecording(getUserId(req), req.body as CreateRecordingInput);
    res.status(201).json(ok({ recording: toRecordingDTO(recording) }));
  }),
);

recordingsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const recording = await findViewableRecording(getUserId(req), param(req, "id"));
    if (!recording) throw HttpError.notFound("Recording not found.");
    const playbackUrl = await getPlaybackUrl(
      recording.userId,
      recording.storageProvider,
      recording.storageFileId,
      recording.id,
    );
    res.json(ok({ recording: toRecordingDTO(recording), playbackUrl }));
  }),
);

// ── AI transcript ──
recordingsRouter.get(
  "/:id/transcript",
  asyncHandler(async (req, res) => {
    const recording = await findViewableRecording(getUserId(req), param(req, "id"));
    if (!recording) throw HttpError.notFound("Recording not found.");
    res.json(ok({ transcript: await getTranscript(recording.id) }));
  }),
);

recordingsRouter.post(
  "/:id/transcript",
  asyncHandler(async (req, res) => {
    const recording = await findOwnedRecording(getUserId(req), param(req, "id"));
    if (!recording) throw HttpError.notFound("Recording not found.");
    const transcript = await generateTranscript(getUserId(req), recording);
    res.json(ok({ transcript }));
  }),
);

recordingsRouter.patch(
  "/:id",
  validate(updateMediaSchema),
  asyncHandler(async (req, res) => {
    const recording = await updateRecording(
      getUserId(req),
      param(req, "id"),
      req.body as UpdateMediaInput,
    );
    res.json(ok({ recording: toRecordingDTO(recording) }));
  }),
);

recordingsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await softDeleteMedia(getUserId(req), ResourceType.RECORDING, param(req, "id"));
    res.json(ok({ deleted: true }));
  }),
);
