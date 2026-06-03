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
  listRecordings,
  softDeleteMedia,
  updateRecording,
} from "../services/media-service.js";

export const recordingsRouter: Router = Router();

recordingsRouter.use(requireAuth);

recordingsRouter.get(
  "/",
  validate(listMediaQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListMediaQuery;
    const page = await listRecordings(getUserId(req), query);
    const body: Paginated<RecordingDTO> = {
      items: page.items.map(toRecordingDTO),
      nextCursor: page.nextCursor,
    };
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
    const recording = await findOwnedRecording(getUserId(req), param(req, "id"));
    if (!recording) throw HttpError.notFound("Recording not found.");
    const playbackUrl = await getPlaybackUrl(recording.storageProvider, recording.storageFileId);
    res.json(ok({ recording: toRecordingDTO(recording), playbackUrl }));
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
