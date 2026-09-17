"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { AppUser } from "@/lib/auth/types";
import { requirePermission } from "@/lib/auth/session";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { syncContractCompletion } from "@/lib/domain/contracts";
import {
  ASSIGN_FILTER_BATCH,
  DELIVERABLE_STATUS,
  SETTLEMENT_MODE,
} from "@/lib/domain/enums";
import {
  buildDeliverableWhere,
  contentFiltersFromForm,
} from "@/lib/domain/contents-query";
import {
  canPublishDeliverables,
  isLiveDeliverable,
  resolveDeliverableState,
} from "@/lib/domain/rules";
import { syncPackSettlement } from "@/lib/domain/pack-sync";
import {
  duplicatePostUrlError,
  postUrlKey,
} from "@/lib/domain/post-url";
import { fieldErrorsFrom } from "@/lib/domain/validation";

export type DeliverableActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const dateField = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : null))
  .refine(
    (value) => value === null || !Number.isNaN(value.getTime()),
    "Fecha no válida"
  );

const updateSchema = z.object({
  deliverableId: z.string().min(1),
  campaignId: z.string().trim().optional().or(z.literal("")),
  status: z.enum([
    DELIVERABLE_STATUS.PENDING,
    DELIVERABLE_STATUS.SCHEDULED,
    DELIVERABLE_STATUS.PUBLISHED,
    DELIVERABLE_STATUS.SUBMITTED,
  ]),
  contentDate: dateField,
  postUrl: z
    .string()
    .trim()
    .url("Enlace no válido")
    .optional()
    .or(z.literal("")),
});

export async function updateDeliverable(
  _prev: DeliverableActionResult | null,
  formData: FormData
): Promise<DeliverableActionResult> {
  const user = await requirePermission("deliverables:publish", "/contenidos");

  const parsed = updateSchema.safeParse({
    deliverableId: formData.get("deliverableId"),
    campaignId: formData.get("campaignId"),
    status: formData.get("status"),
    contentDate: formData.get("contentDate"),
    postUrl: formData.get("postUrl"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const data = parsed.data;

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: data.deliverableId },
    include: {
      contract: { include: { client: true } },
      campaign: { include: { client: true } },
    },
  });

  if (!deliverable) {
    return { ok: false, error: "Ese contenido no existe." };
  }

  if (
    data.status === DELIVERABLE_STATUS.SUBMITTED &&
    deliverable.status !== DELIVERABLE_STATUS.SUBMITTED
  ) {
    return {
      ok: false,
      error:
        "Subir un contenido a la plataforma del cliente se hace desde Finanzas, no desde esta tabla.",
    };
  }

  if (
    deliverable.status === DELIVERABLE_STATUS.SUBMITTED &&
    data.status !== DELIVERABLE_STATUS.SUBMITTED
  ) {
    return {
      ok: false,
      error:
        "Este contenido ya está en la plataforma del cliente. Si hay que sacarlo, lo hace Finanzas.",
    };
  }

  if (
    data.status === DELIVERABLE_STATUS.PUBLISHED &&
    !canPublishDeliverables(deliverable.contract.status)
  ) {
    return {
      ok: false,
      error:
        "Este contrato está cancelado; no se pueden marcar contenidos como publicados.",
    };
  }

  const nextCampaignId = data.campaignId || null;
  const previousCampaignId = deliverable.campaignId;
  const campaign = nextCampaignId
    ? await prisma.campaign.findUnique({
        where: { id: nextCampaignId },
        include: { client: true },
      })
    : null;

  if (
    campaign &&
    deliverable.contract.clientId &&
    campaign.clientId &&
    campaign.clientId !== deliverable.contract.clientId
  ) {
    return {
      ok: false,
      error:
        "Esa campaña es de otro cliente. Este contrato es solo de " +
        (deliverable.contract.client?.name ?? "su cliente") +
        ".",
    };
  }

  const policy =
    campaign?.client ?? deliverable.contract.client ?? null;

  const resolved = resolveDeliverableState({
    status: data.status,
    previousStatus: deliverable.status,
    contentDate: data.contentDate,
    postUrl: data.postUrl,
    paymentTermDays: deliverable.contract.paymentTermDays,
    deferPayment: policy?.settlementMode === SETTLEMENT_MODE.PACK,
  });

  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  const nextPostUrl = data.postUrl || null;
  const nextPostUrlKey = postUrlKey(nextPostUrl);
  if (nextPostUrlKey) {
    const taken = await prisma.deliverable.findFirst({
      where: { postUrlKey: nextPostUrlKey, id: { not: deliverable.id } },
      include: {
        contract: { include: { creator: { select: { handle: true } } } },
      },
    });
    if (taken) {
      const message = duplicatePostUrlError(taken);
      return { ok: false, error: message, fieldErrors: { postUrl: message } };
    }
  }

  const statusChanged = resolved.value.status !== deliverable.status;
  const campaignChanged = nextCampaignId !== previousCampaignId;
  const dateChanged =
    (resolved.value.scheduledFor?.toISOString() ?? null) !==
      (deliverable.scheduledFor?.toISOString() ?? null) ||
    (resolved.value.publishedAt?.toISOString() ?? null) !==
      (deliverable.publishedAt?.toISOString() ?? null);
  const liveChanged =
    isLiveDeliverable(resolved.value.status) !==
    isLiveDeliverable(deliverable.status);

  try {
    await prisma.deliverable.update({
      where: { id: deliverable.id },
      data: {
        postUrl: nextPostUrl,
        postUrlKey: nextPostUrlKey,
        ...resolved.value,
        campaign: nextCampaignId
          ? { connect: { id: nextCampaignId } }
          : { disconnect: true },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientValidationError) {
      return {
        ok: false,
        error:
          "No se ha podido guardar. Recarga la página e inténtalo otra vez.",
      };
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const taken = nextPostUrlKey
        ? await prisma.deliverable.findFirst({
            where: { postUrlKey: nextPostUrlKey, id: { not: deliverable.id } },
            include: {
              contract: { include: { creator: { select: { handle: true } } } },
            },
          })
        : null;
      const message = taken
        ? duplicatePostUrlError(taken)
        : "Ese enlace ya está en otro contenido.";
      return { ok: false, error: message, fieldErrors: { postUrl: message } };
    }
    throw error;
  }

  if (statusChanged) {
    await syncContractCompletion(deliverable.contractId);
  }

  if (statusChanged || campaignChanged || dateChanged) {
    await syncPackSettlement({
      campaignId: nextCampaignId,
      creatorId: deliverable.contract.creatorId,
    });
    if (previousCampaignId && previousCampaignId !== nextCampaignId) {
      await syncPackSettlement({
        campaignId: previousCampaignId,
        creatorId: deliverable.contract.creatorId,
      });
    }
  }

  await recordAudit({
    entityType: "Deliverable",
    entityId: deliverable.id,
    action: "UPDATED",
    actor: user,
    metadata: {
      contractCode: deliverable.contract.code,
      position: deliverable.position,
      status: resolved.value.status,
      scheduledFor: resolved.value.scheduledFor?.toISOString() ?? null,
      publishedAt: resolved.value.publishedAt?.toISOString() ?? null,
    },
  });

  // Un cambio de enlace no recarga Panel/Finanzas/Creators. Publicado o pack sí.
  if (statusChanged || campaignChanged || dateChanged) {
    revalidatePath("/contenidos");
    revalidatePath(`/contratos/${deliverable.contractId}`);
  }
  if (liveChanged || campaignChanged) {
    revalidatePath("/finanzas");
    revalidatePath("/");
    revalidatePath("/creators");
  }

  return { ok: true };
}

// Agrupar varios contenidos en una campaña de una vez.
async function assignIdsToCampaign(
  user: AppUser,
  ids: string[],
  campaignId: string
): Promise<DeliverableActionResult> {
  if (ids.length === 0) {
    return { ok: false, error: "No has seleccionado ningún contenido." };
  }

  const existing = await prisma.deliverable.findMany({
    where: { id: { in: ids } },
    include: { contract: { include: { client: true, creator: true } } },
  });

  if (campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return { ok: false, error: "Esa campaña no existe." };
    }

    const mismatch = existing.find(
      (item) =>
        item.contract.clientId &&
        campaign.clientId &&
        item.contract.clientId !== campaign.clientId
    );

    if (mismatch) {
      return {
        ok: false,
        error: `El contrato de @${mismatch.contract.creator.handle} no es de ese cliente. Higgsfield y Many Chat van en contratos distintos.`,
      };
    }
  }

  const result = await prisma.deliverable.updateMany({
    where: { id: { in: ids } },
    data: { campaignId: campaignId || null },
  });

  const packs = new Map<string, { campaignId: string | null; creatorId: string }>();
  for (const item of existing) {
    packs.set(`${item.campaignId ?? ""}:${item.contract.creatorId}`, {
      campaignId: item.campaignId,
      creatorId: item.contract.creatorId,
    });
    packs.set(`${campaignId || ""}:${item.contract.creatorId}`, {
      campaignId: campaignId || null,
      creatorId: item.contract.creatorId,
    });
  }
  await Promise.all(
    [...packs.values()].map((pack) => syncPackSettlement(pack))
  );

  await recordAudit({
    entityType: "Deliverable",
    entityId: ids.join(","),
    action: campaignId ? "CAMPAIGN_ASSIGNED" : "CAMPAIGN_CLEARED",
    actor: user,
    metadata: { count: result.count, campaignId: campaignId || null },
  });

  revalidatePath("/contenidos");
  revalidatePath("/campanas");
  revalidatePath("/finanzas");
  revalidatePath("/");

  return { ok: true };
}

export async function assignCampaign(
  _prev: DeliverableActionResult | null,
  formData: FormData
): Promise<DeliverableActionResult> {
  const user = await requirePermission("campaigns:manage", "/contenidos");
  const ids = formData.getAll("deliverableIds").map(String).filter(Boolean);
  const campaignId = String(formData.get("campaignId") ?? "");
  return assignIdsToCampaign(user, ids, campaignId);
}

export async function assignCampaignToFilter(
  _prev: DeliverableActionResult | null,
  formData: FormData
): Promise<DeliverableActionResult> {
  const user = await requirePermission("campaigns:manage", "/contenidos");
  const campaignId = String(formData.get("campaignId") ?? "");
  const filters = contentFiltersFromForm(formData);
  const where = buildDeliverableWhere(filters);
  const matches = await prisma.deliverable.findMany({
    where,
    take: ASSIGN_FILTER_BATCH,
    select: { id: true },
    orderBy: [{ createdAt: "asc" }],
  });
  const ids = matches.map((item) => item.id);
  if (ids.length === 0) {
    return { ok: false, error: "Ningún contenido del filtro para asignar." };
  }
  return assignIdsToCampaign(user, ids, campaignId);
}
