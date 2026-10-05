"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { DELIVERABLE_STATUS } from "@/lib/domain/enums";

export async function moveDeliverableDates(ids: string[], dateValue: string) {
  const user = await requirePermission("deliverables:publish", "/");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || ids.length === 0) {
    return { ok: false as const, error: "La fecha no es válida." };
  }
  const scheduledFor = new Date(`${dateValue}T00:00:00.000Z`);
  const changed = await prisma.deliverable.updateMany({
    where: {
      id: { in: ids },
      status: { in: [DELIVERABLE_STATUS.PENDING, DELIVERABLE_STATUS.SCHEDULED] },
    },
    data: { scheduledFor, status: DELIVERABLE_STATUS.SCHEDULED },
  });
  await recordAudit({
    entityType: "Deliverable",
    entityId: ids[0] ?? "batch",
    action: "DATE_MOVED",
    actor: user,
    metadata: { count: changed.count, date: dateValue },
  });
  revalidatePath("/");
  revalidatePath("/contenidos");
  return { ok: true as const, count: changed.count };
}
