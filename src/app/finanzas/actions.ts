"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { CONTRACT_STATUS, DELIVERABLE_STATUS } from "@/lib/domain/enums";
import {
  isPayableWithPolicy,
  packKey,
  settlementPolicyOf,
  summarizePacks,
} from "@/lib/domain/settlement";

export type FinanceActionResult = {
  ok: boolean;
  error?: string;
  count?: number;
};

function revalidateFinance() {
  revalidatePath("/finanzas");
  revalidatePath("/contenidos");
  revalidatePath("/contratos");
  revalidatePath("/");
}

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

  revalidateFinance();

  return { ok: true, count: ids.length };
}

export async function markPaid(
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
      contract: { include: { client: true } },
      campaign: { include: { client: true } },
    },
  });

  if (items.length !== ids.length) {
    return { ok: false, error: "Alguno de esos contenidos ya no existe." };
  }

  if (items.some((item) => item.paidAt)) {
    return {
      ok: false,
      error: "Alguno ya estaba marcado como pagado.",
    };
  }

  if (
    items.some((item) => item.contract.status === CONTRACT_STATUS.CANCELLED)
  ) {
    return {
      ok: false,
      error: "No se puede pagar un contrato cancelado.",
    };
  }

  const campaignIds = [
    ...new Set(
      items
        .map((item) => item.campaignId)
        .filter((campaignId): campaignId is string => Boolean(campaignId))
    ),
  ];

  const packCompleteByKey = new Map<string, boolean>();

  if (campaignIds.length > 0) {
    const siblings = await prisma.deliverable.findMany({
      where: { campaignId: { in: campaignIds } },
      select: {
        status: true,
        campaignId: true,
        contract: { select: { creatorId: true } },
      },
    });
    const packs = summarizePacks(
      siblings.flatMap((item) => {
        if (!item.campaignId) return [];
        return [
          {
            campaignId: item.campaignId,
            creatorId: item.contract.creatorId,
            status: item.status,
          },
        ];
      })
    );
    for (const [key, progress] of packs) {
      packCompleteByKey.set(key, progress.isComplete);
    }
  }

  const notPayable = items.filter((item) => {
    const policy = settlementPolicyOf({
      client: item.contract.client,
      campaign: item.campaign,
    });
    const complete = item.campaignId
      ? (packCompleteByKey.get(
          packKey(item.campaignId, item.contract.creatorId)
        ) ?? false)
      : false;
    return !isPayableWithPolicy(item.status, policy, complete);
  });

  if (notPayable.length > 0) {
    return {
      ok: false,
      error:
        "Solo se puede pagar lo que ya está en cola: submitted en plataforma, o el pack cerrado.",
    };
  }

  const now = new Date();

  await prisma.deliverable.updateMany({
    where: { id: { in: ids } },
    data: { paidAt: now },
  });

  await recordAudit({
    entityType: "Deliverable",
    entityId: ids.join(","),
    action: "PAID",
    actor: user,
    metadata: { count: ids.length },
  });

  revalidateFinance();

  return { ok: true, count: ids.length };
}
