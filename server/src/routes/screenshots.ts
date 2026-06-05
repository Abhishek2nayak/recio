/**
 * Screenshot metadata CRUD — mirrors the recordings routes for images.
 *
 *   GET    /screenshots        paginated dashboard list (filter/sort/search)
 *   POST   /screenshots        create the metadata row after an upload
 *   GET    /screenshots/:id     one screenshot (owner only)
 *   PATCH  /screenshots/:id     rename / visibility (Drive ACL side-effect)
 *   DELETE /screenshots/:id     soft delete (+ best-effort object removal)
 */
import { Router } from "express";
import {
  ok,
  ResourceType,
  createScreenshotSchema,
  listMediaQuerySchema,
  updateMediaSchema,
  type CreateScreenshotInput,
  type ListMediaQuery,
  type Paginated,
  type ScreenshotDTO,
  type UpdateMediaInput,
} from "@flowcap/shared";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { toScreenshotDTO } from "../lib/dto.js";
import { HttpError } from "../lib/http-error.js";
import { param } from "../lib/params.js";
import { getPlaybackUrl } from "../services/storage-service.js";
import {
  createScreenshot,
  findOwnedScreenshot,
  listScreenshots,
  softDeleteMedia,
  updateScreenshot,
} from "../services/media-service.js";

export const screenshotsRouter: Router = Router();

screenshotsRouter.use(requireAuth);

screenshotsRouter.get(
  "/",
  validate(listMediaQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as ListMediaQuery;
    const page = await listScreenshots(getUserId(req), query);
    const body: Paginated<ScreenshotDTO> = {
      items: page.items.map(toScreenshotDTO),
      nextCursor: page.nextCursor,
    };
    res.json(ok(body));
  }),
);

screenshotsRouter.post(
  "/",
  validate(createScreenshotSchema),
  asyncHandler(async (req, res) => {
    const screenshot = await createScreenshot(getUserId(req), req.body as CreateScreenshotInput);
    res.status(201).json(ok({ screenshot: toScreenshotDTO(screenshot) }));
  }),
);

screenshotsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const screenshot = await findOwnedScreenshot(getUserId(req), param(req, "id"));
    if (!screenshot) throw HttpError.notFound("Screenshot not found.");
    const playbackUrl = await getPlaybackUrl(
      screenshot.userId,
      screenshot.storageProvider,
      screenshot.storageFileId,
      screenshot.id,
    );
    res.json(ok({ screenshot: toScreenshotDTO(screenshot), playbackUrl }));
  }),
);

screenshotsRouter.patch(
  "/:id",
  validate(updateMediaSchema),
  asyncHandler(async (req, res) => {
    const screenshot = await updateScreenshot(
      getUserId(req),
      param(req, "id"),
      req.body as UpdateMediaInput,
    );
    res.json(ok({ screenshot: toScreenshotDTO(screenshot) }));
  }),
);

screenshotsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await softDeleteMedia(getUserId(req), ResourceType.SCREENSHOT, param(req, "id"));
    res.json(ok({ deleted: true }));
  }),
);
