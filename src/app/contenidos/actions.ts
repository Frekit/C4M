"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { syncContractCompletion } from "@/lib/domain/contracts";
import { DELIVERABLE_STATUS } from "@/lib/domain/enums";
import {
  canPublishDeliverables,
  resolveDeliverableState,
} from "@/lib/domain/rules";
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
    include: { contract: true },
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
        "Firma el contrato antes de marcarlo como publicado: si no, se devengaría dinero sin acuerdo firmado.",
    };
  }

  const resolved = resolveDeliverableState({
    status: data.status,
    previousStatus: deliverable.status,
    contentDate: data.contentDate,
    postUrl: data.postUrl,
    paymentTermDays: deliverable.contract.paymentTermDays,
  });

  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  await prisma.deliverable.update({
    where: { id: deliverable.id },
    data: {
      campaignId: data.campaignId || null,
      postUrl: data.postUrl || null,
      ...resolved.value,
    },
  });

  await syncContractCompletion(deliverable.contractId);

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

  revalidatePath("/contenidos");
  revalidatePath("/finanzas");
  revalidatePath(`/contratos/${deliverable.contractId}`);
  revalidatePath("/creators");
  revalidatePath("/");

  return { ok: true };
}

// Agrupar varios contenidos en una campaña de una vez.
export async function assignCampaign(
  _prev: DeliverableActionResult | null,
  formData: FormData
): Promise<DeliverableActionResult> {
  const user = await requirePermission("campaigns:manage", "/contenidos");

  const ids = formData.getAll("deliverableIds").map(String).filter(Boolean);
  const campaignId = String(formData.get("campaignId") ?? "");

  if (ids.length === 0) {
    return { ok: false, error: "No has seleccionado ningún contenido." };
  }

  if (campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      return { ok: false, error: "Esa campaña no existe." };
    }
  }

  const result = await prisma.deliverable.updateMany({
    where: { id: { in: ids } },
    data: { campaignId: campaignId || null },
  });

  await recordAudit({
    entityType: "Deliverable",
    entityId: ids.join(","),
    action: campaignId ? "CAMPAIGN_ASSIGNED" : "CAMPAIGN_CLEARED",
    actor: user,
    metadata: { count: result.count, campaignId: campaignId || null },
  });

  revalidatePath("/contenidos");
  revalidatePath("/campanas");

  return { ok: true };
}
