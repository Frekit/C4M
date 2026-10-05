"use server";

import { redirect } from "next/navigation";

import { isAuth0Active } from "@/lib/auth/config";
import {
  LOCAL_SESSION_COOKIE,
  localSessionCookieOptions,
} from "@/lib/auth/local-session";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { acceptInvitationSchema, fieldErrorsFrom } from "@/lib/domain/validation";

export type AcceptResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function acceptInvitation(
  _prev: AcceptResult | null,
  formData: FormData
): Promise<AcceptResult> {
  const parsed = acceptInvitationSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { token, name } = parsed.data;

  const invitation = await prisma.invitation.findUnique({ where: { token } });

  if (
    !invitation ||
    invitation.revokedAt ||
    invitation.acceptedAt ||
    invitation.expiresAt < new Date()
  ) {
    return { ok: false, error: "Esta invitación ya no es válida." };
  }

  const user = await prisma.user.upsert({
    where: { email: invitation.email },
    create: {
      email: invitation.email,
      name,
      role: invitation.role,
      status: "ACTIVE",
      invitedBy: invitation.invitedBy,
    },
    update: { name, role: invitation.role, status: "ACTIVE" },
  });

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { acceptedAt: new Date() },
  });

  await recordAudit({
    entityType: "User",
    entityId: user.email,
    action: "INVITATION_ACCEPTED",
    actorEmail: user.email,
    metadata: { role: user.role },
  });

  // En Auth0 la sesión la crea el propio proveedor; en local basta la cookie.
  if (isAuth0Active()) {
    redirect("/auth/login?returnTo=%2F");
  }

  const jar = await cookies();
  jar.set(
    LOCAL_SESSION_COOKIE,
    JSON.stringify({ email: user.email, name: user.name ?? user.email }),
    localSessionCookieOptions
  );

  redirect("/");
}
