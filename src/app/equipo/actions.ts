"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getBaseUrl } from "@/lib/base-url";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/domain/enums";
import { fieldErrorsFrom, inviteSchema } from "@/lib/domain/validation";
import { mailStatusCopy, sendMail } from "@/lib/mail/send";
import { invitationMailCopy } from "@/lib/mail/templates";

export type ActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  invitationUrl?: string;
  mailStatus?: "sent" | "skipped" | "failed";
  message?: string;
};

export async function inviteMember(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requirePermission("team:manage", "/equipo");

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { email, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "Esa cuenta ya tiene acceso." };
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  await prisma.invitation.upsert({
    where: { email },
    create: { email, role, token, invitedBy: admin.email, expiresAt },
    update: {
      role,
      token,
      invitedBy: admin.email,
      expiresAt,
      acceptedAt: null,
      revokedAt: null,
    },
  });

  const baseUrl = await getBaseUrl();
  const invitationUrl = `/invitacion/${token}`;
  const mail = await sendMail({
    to: email,
    ...invitationMailCopy({
      roleLabel: ROLE_LABELS[role],
      url: `${baseUrl}${invitationUrl}`,
      expiresAt,
    }),
  });

  await recordAudit({
    entityType: "Invitation",
    entityId: email,
    action: "INVITED",
    actor: admin,
    metadata: { role, mailStatus: mail.status },
  });

  revalidatePath("/equipo");

  return {
    ok: true,
    invitationUrl,
    mailStatus: mail.status,
    message: mailStatusCopy(mail),
  };
}

export async function revokeInvitation(formData: FormData) {
  const admin = await requirePermission("team:manage", "/equipo");
  const id = String(formData.get("invitationId") ?? "");

  const invitation = await prisma.invitation.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  await recordAudit({
    entityType: "Invitation",
    entityId: invitation.email,
    action: "REVOKED",
    actor: admin,
  });

  revalidatePath("/equipo");
}

export async function changeMemberRole(formData: FormData) {
  const admin = await requirePermission("team:manage", "/equipo");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;

  if (!Object.values(ROLES).includes(role)) {
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return;

  // No dejar el sistema sin ningún administrador activo.
  if (target.role === ROLES.ADMIN && role !== ROLES.ADMIN) {
    const admins = await prisma.user.count({
      where: { role: ROLES.ADMIN, status: "ACTIVE" },
    });

    if (admins <= 1) {
      return;
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });

  await recordAudit({
    entityType: "User",
    entityId: target.email,
    action: "ROLE_CHANGED",
    actor: admin,
    metadata: { from: target.role, to: role },
  });

  revalidatePath("/equipo");
}

export async function setMemberStatus(formData: FormData) {
  const admin = await requirePermission("team:manage", "/equipo");
  const userId = String(formData.get("userId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (status !== "ACTIVE" && status !== "DISABLED") return;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.id === admin.id) return;

  if (target.role === ROLES.ADMIN && status === "DISABLED") {
    const admins = await prisma.user.count({
      where: { role: ROLES.ADMIN, status: "ACTIVE" },
    });

    if (admins <= 1) return;
  }

  await prisma.user.update({ where: { id: userId }, data: { status } });

  await recordAudit({
    entityType: "User",
    entityId: target.email,
    action: status === "ACTIVE" ? "ENABLED" : "DISABLED",
    actor: admin,
  });

  revalidatePath("/equipo");
}
