/**
 * Team workspaces.
 *
 *   POST   /workspaces                       create (team entitlement)   [auth]
 *   GET    /workspaces                       my workspaces               [auth]
 *   GET    /workspaces/:id/members           list members                [auth, member]
 *   GET    /workspaces/:id/invites           pending invites             [auth, manager]
 *   POST   /workspaces/:id/invites           invite by email → token     [auth, manager]
 *   DELETE /workspaces/:id/invites/:inviteId revoke an invite            [auth, manager]
 *   PATCH  /workspaces/:id/members/:userId   change role                 [auth, manager]
 *   DELETE /workspaces/:id/members/:userId   remove member               [auth, manager]
 *   POST   /workspaces/invites/:token/accept join via invite link        [auth]
 */
import { Router } from "express";
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  ok,
  updateMemberRoleSchema,
  type CreateWorkspaceInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
} from "@flowcap/shared";
import { asyncHandler } from "../middleware/error.js";
import { requireAuth, getUserId } from "../middleware/auth.js";
import { requireEntitlement } from "../middleware/entitlement.js";
import { validate } from "../middleware/validate.js";
import { param } from "../lib/params.js";
import {
  acceptInvite,
  createInvite,
  createWorkspace,
  listInvites,
  listMembers,
  listMyWorkspaces,
  removeMember,
  requireManager,
  requireMember,
  revokeInvite,
  setMemberRole,
} from "../services/workspace-service.js";

export const workspacesRouter: Router = Router();
workspacesRouter.use(requireAuth);

// Join via an invite link (any logged-in user holding the token).
workspacesRouter.post(
  "/invites/:token/accept",
  asyncHandler(async (req, res) => {
    const workspace = await acceptInvite(param(req, "token"), getUserId(req));
    res.json(ok({ workspace }));
  }),
);

workspacesRouter.post(
  "/",
  requireEntitlement("team"),
  validate(createWorkspaceSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.body as CreateWorkspaceInput;
    res.status(201).json(ok({ workspace: await createWorkspace(getUserId(req), name) }));
  }),
);

workspacesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(ok({ workspaces: await listMyWorkspaces(getUserId(req)) }));
  }),
);

workspacesRouter.get(
  "/:id/members",
  asyncHandler(async (req, res) => {
    await requireMember(getUserId(req), param(req, "id"));
    res.json(ok({ members: await listMembers(param(req, "id")) }));
  }),
);

workspacesRouter.get(
  "/:id/invites",
  asyncHandler(async (req, res) => {
    await requireManager(getUserId(req), param(req, "id"));
    res.json(ok({ invites: await listInvites(param(req, "id")) }));
  }),
);

workspacesRouter.post(
  "/:id/invites",
  validate(inviteMemberSchema),
  asyncHandler(async (req, res) => {
    await requireManager(getUserId(req), param(req, "id"));
    const { email, role } = req.body as InviteMemberInput;
    const invite = await createInvite(param(req, "id"), getUserId(req), email, role);
    res.status(201).json(ok({ invite }));
  }),
);

workspacesRouter.delete(
  "/:id/invites/:inviteId",
  asyncHandler(async (req, res) => {
    await requireManager(getUserId(req), param(req, "id"));
    await revokeInvite(param(req, "id"), param(req, "inviteId"));
    res.json(ok({ revoked: true }));
  }),
);

workspacesRouter.patch(
  "/:id/members/:userId",
  validate(updateMemberRoleSchema),
  asyncHandler(async (req, res) => {
    await requireManager(getUserId(req), param(req, "id"));
    const { role } = req.body as UpdateMemberRoleInput;
    await setMemberRole(param(req, "id"), param(req, "userId"), role);
    res.json(ok({ updated: true }));
  }),
);

workspacesRouter.delete(
  "/:id/members/:userId",
  asyncHandler(async (req, res) => {
    await requireManager(getUserId(req), param(req, "id"));
    await removeMember(param(req, "id"), param(req, "userId"));
    res.json(ok({ removed: true }));
  }),
);
