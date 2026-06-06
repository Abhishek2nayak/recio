/**
 * Team workspaces: a shared space with members (roles) and a shared media library.
 * Authorization helpers (`requireMember`/`requireManager`) throw so routes stay thin.
 */
import { ErrorCode, WorkspaceRole, type InviteDTO, type MemberDTO, type WorkspaceDTO } from "@flowcap/shared";
import type { Invite, Membership } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";

const INVITE_TTL_DAYS = 14;

export async function createWorkspace(userId: string, name: string): Promise<WorkspaceDTO> {
  const ws = await prisma.workspace.create({
    data: { name, ownerId: userId, members: { create: { userId, role: "OWNER" } } },
  });
  return { id: ws.id, name: ws.name, role: WorkspaceRole.OWNER, memberCount: 1, createdAt: ws.createdAt.toISOString() };
}

export async function listMyWorkspaces(userId: string): Promise<WorkspaceDTO[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { workspace: { include: { _count: { select: { members: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    role: m.role as WorkspaceRole,
    memberCount: m.workspace._count.members,
    createdAt: m.workspace.createdAt.toISOString(),
  }));
}

/** Caller must belong to the workspace; returns their membership. */
export async function requireMember(userId: string, workspaceId: string): Promise<Membership> {
  const m = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!m) throw HttpError.notFound("Workspace not found.");
  return m;
}

/** Caller must be OWNER or ADMIN (manage members/invites). */
export async function requireManager(userId: string, workspaceId: string): Promise<Membership> {
  const m = await requireMember(userId, workspaceId);
  if (m.role === "MEMBER") throw HttpError.forbidden("You don't have permission to manage this workspace.");
  return m;
}

export async function listMembers(workspaceId: string): Promise<MemberDTO[]> {
  const members = await prisma.membership.findMany({ where: { workspaceId }, orderBy: { createdAt: "asc" } });
  const users = await prisma.user.findMany({
    where: { id: { in: members.map((m) => m.userId) } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return members.map((m) => ({
    userId: m.userId,
    name: byId.get(m.userId)?.name ?? null,
    email: byId.get(m.userId)?.email ?? "",
    role: m.role as WorkspaceRole,
    joinedAt: m.createdAt.toISOString(),
  }));
}

function toInviteDTO(i: Invite): InviteDTO {
  return {
    id: i.id,
    email: i.email,
    role: i.role as WorkspaceRole,
    token: i.token,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  };
}

export async function createInvite(
  workspaceId: string,
  invitedByUserId: string,
  email: string,
  role: "ADMIN" | "MEMBER",
): Promise<InviteDTO> {
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
  const invite = await prisma.invite.create({
    data: { workspaceId, invitedByUserId, email: email.toLowerCase(), role, expiresAt },
  });
  return toInviteDTO(invite);
}

export async function listInvites(workspaceId: string): Promise<InviteDTO[]> {
  const invites = await prisma.invite.findMany({
    where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return invites.map(toInviteDTO);
}

export async function revokeInvite(workspaceId: string, inviteId: string): Promise<void> {
  await prisma.invite.deleteMany({ where: { id: inviteId, workspaceId } });
}

/** Accept an invite link as the logged-in user; idempotent (re-accept is a no-op). */
export async function acceptInvite(token: string, userId: string): Promise<WorkspaceDTO> {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) throw HttpError.notFound("This invite doesn't exist.");
  if (invite.expiresAt < new Date()) throw new HttpError(ErrorCode.RESOURCE_GONE, "This invite has expired.");

  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
    create: { workspaceId: invite.workspaceId, userId, role: invite.role },
    update: {},
  });
  if (!invite.acceptedAt) {
    await prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: invite.workspaceId },
    include: { _count: { select: { members: true } } },
  });
  if (!ws) throw HttpError.notFound("Workspace not found.");
  const me = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: ws.id, userId } },
  });
  return {
    id: ws.id,
    name: ws.name,
    role: (me?.role ?? WorkspaceRole.MEMBER) as WorkspaceRole,
    memberCount: ws._count.members,
    createdAt: ws.createdAt.toISOString(),
  };
}

export async function removeMember(workspaceId: string, targetUserId: string): Promise<void> {
  const target = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  });
  if (!target) throw HttpError.notFound("Member not found.");
  if (target.role === "OWNER") throw HttpError.badRequest("The workspace owner can't be removed.");
  await prisma.membership.delete({ where: { id: target.id } });
}

export async function setMemberRole(
  workspaceId: string,
  targetUserId: string,
  role: "ADMIN" | "MEMBER",
): Promise<void> {
  const target = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
  });
  if (!target) throw HttpError.notFound("Member not found.");
  if (target.role === "OWNER") throw HttpError.badRequest("The owner's role can't be changed.");
  await prisma.membership.update({ where: { id: target.id }, data: { role } });
}
