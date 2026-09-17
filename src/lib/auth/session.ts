import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import type { Role } from "@/lib/domain/enums";

import { getAuth0Client } from "./auth0";
import { isAuth0Active } from "./config";
import { getLocalIdentity } from "./local-session";
import { assertCan, type Permission } from "./permissions";
import type { AccessState, AppUser, SessionIdentity } from "./types";

async function getIdentity(): Promise<SessionIdentity | null> {
  if (isAuth0Active()) {
    const auth0 = getAuth0Client();
    const session = auth0 ? await auth0.getSession() : null;
    const user = session?.user;

    if (!user?.sub || !user.email) {
      return null;
    }

    return {
      sub: user.sub,
      email: String(user.email).toLowerCase(),
      name: user.name ?? user.nickname ?? String(user.email),
      picture: user.picture ?? null,
      provider: "auth0",
    };
  }

  return getLocalIdentity();
}

export async function getAccessState(): Promise<AccessState> {
  const identity = await getIdentity();

  if (!identity) {
    return { kind: "anonymous" };
  }

  const record = await prisma.user.findUnique({
    where: { email: identity.email },
  });

  if (!record) {
    return { kind: "not_invited", identity };
  }

  if (record.status !== "ACTIVE") {
    return { kind: "disabled", identity };
  }

  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const needsTouch =
    record.authSub !== identity.sub ||
    !record.lastLoginAt ||
    record.lastLoginAt < twelveHoursAgo;

  if (needsTouch) {
    await prisma.user.update({
      where: { id: record.id },
      data: { authSub: identity.sub, lastLoginAt: new Date() },
    });
  }

  return {
    kind: "active",
    user: {
      id: record.id,
      email: record.email,
      name: record.name ?? identity.name,
      role: record.role as Role,
      provider: identity.provider,
      picture: identity.picture ?? null,
    },
  };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const state = await getAccessState();
  return state.kind === "active" ? state.user : null;
}

export async function requireUser(returnTo = "/"): Promise<AppUser> {
  const state = await getAccessState();

  if (state.kind === "anonymous") {
    redirect(`/iniciar-sesion?returnTo=${encodeURIComponent(returnTo)}`);
  }

  if (state.kind !== "active") {
    redirect(`/sin-acceso?motivo=${state.kind}`);
  }

  return state.user;
}

export async function requirePermission(
  permission: Permission,
  returnTo = "/"
): Promise<AppUser> {
  const user = await requireUser(returnTo);
  assertCan(user.role, permission);
  return user;
}
