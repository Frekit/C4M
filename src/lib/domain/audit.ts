import { headers } from "next/headers";

import { prisma } from "@/lib/db";
import type { AppUser } from "@/lib/auth/types";

export async function requestContext() {
  try {
    const list = await headers();

    return {
      ip:
        list.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        list.get("x-real-ip") ??
        null,
      userAgent: list.get("user-agent"),
    };
  } catch {
    // Fuera de una petición (tests, tareas) no hay cabeceras que guardar.
    return { ip: null, userAgent: null };
  }
}

export async function recordAudit(input: {
  entityType: string;
  entityId: string;
  action: string;
  actor?: AppUser | null;
  actorEmail?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const context = await requestContext();

  await prisma.auditEvent.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorEmail: input.actor?.email ?? input.actorEmail ?? null,
      actorRole: input.actor?.role ?? null,
      ip: context.ip,
      userAgent: context.userAgent,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
