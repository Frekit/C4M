"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { DELIVERABLE_STATUS } from "@/lib/domain/enums";

export type FinanceActionResult = {
  ok: boolean;
  error?: string;
  count?: number;
};

export async function markClientSubmitted(
  _prev: FinanceActionResult | null,
  formData: FormData
): Promise<FinanceActionResult> {
  const user = await requirePermission("finance:manage", "/finanzas");
  const ids = formData.getAll("deliverableIds").map(String).filter(Boolean);

  if (ids.length === 0) {
    return { ok: false, error: "No has seleccionado ningún contenido." };
  }

  const items = await prisma.deliverable.findMany({
    where: { id: { in: ids } },
    include: {
      contract: true,
      campaign: { include: { client: true } },
    },
  });

  if (items.length !== ids.length) {
    return { ok: false, error: "Alguno de esos contenidos ya no existe." };
  }

  const notPlatform = items.filter(
    (item) => item.campaign?.client?.requiresPlatformSubmit !== true
  );

  if (notPlatform.length > 0) {
    return {
      ok: false,
      error:
        "Ese cliente no tiene plataforma: con Publicado en redes ya está entregado.",
    };
  }

  const notReady = items.filter(
    (item) =>
      item.status !== DELIVERABLE_STATUS.PUBLISHED || !item.postUrl
  );

  if (notReady.length > 0) {
    return {
      ok: false,
      error:
        "Solo se pueden subir los que están publicados y tienen enlace del post.",
    };
  }

  const now = new Date();

  await prisma.deliverable.updateMany({
    where: { id: { in: ids } },
    data: {
      status: DELIVERABLE_STATUS.SUBMITTED,
      clientSubmittedAt: now,
    },
  });

  await recordAudit({
    entityType: "Deliverable",
    entityId: ids.join(","),
    action: "SUBMITTED",
    actor: user,
    metadata: { count: ids.length },
  });

  revalidatePath("/finanzas");
  revalidatePath("/contenidos");
  revalidatePath("/contratos");
  revalidatePath("/");

  return { ok: true, count: ids.length };
}
