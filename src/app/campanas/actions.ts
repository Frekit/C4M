"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { CAMPAIGN_STATUS, SETTLEMENT_MODE } from "@/lib/domain/enums";
import { fieldErrorsFrom } from "@/lib/domain/validation";

export type CampaignActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const optionalDate = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : null))
  .refine(
    (value) => value === null || !Number.isNaN(value.getTime()),
    "Fecha no válida"
  );

const campaignSchema = z.object({
  name: z.string().trim().min(2, "Ponle un nombre").max(120),
  clientId: z.string().trim().optional().or(z.literal("")),
  newClientName: z.string().trim().max(120).optional().or(z.literal("")),
  newSettlementMode: z
    .enum([SETTLEMENT_MODE.PER_CONTENT, SETTLEMENT_MODE.PACK])
    .optional(),
  newRequiresPlatformSubmit: z
    .any()
    .optional()
    .transform((value) => value === "1" || value === "true" || value === "on"),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  startsAt: optionalDate,
  endsAt: optionalDate,
});

async function resolveClientId(data: {
  clientId?: string;
  newClientName?: string;
  newSettlementMode?: string;
  newRequiresPlatformSubmit?: boolean;
}): Promise<{ ok: true; clientId: string | null } | { ok: false; error: string; field?: string }> {
  if (data.clientId && data.clientId !== "__new__") {
    const existing = await prisma.client.findUnique({
      where: { id: data.clientId },
    });
    if (!existing) {
      return { ok: false, error: "Ese cliente no existe.", field: "clientId" };
    }
    return { ok: true, clientId: existing.id };
  }

  const newName = data.newClientName?.trim() ?? "";
  if (!newName) {
    return { ok: true, clientId: null };
  }

  const duplicate = await prisma.client.findUnique({ where: { name: newName } });
  if (duplicate) {
    return { ok: true, clientId: duplicate.id };
  }

  const created = await prisma.client.create({
    data: {
      name: newName,
      settlementMode: data.newSettlementMode ?? SETTLEMENT_MODE.PER_CONTENT,
      requiresPlatformSubmit: data.newRequiresPlatformSubmit ?? true,
    },
  });

  return { ok: true, clientId: created.id };
}

export async function createCampaign(
  _prev: CampaignActionResult | null,
  formData: FormData
): Promise<CampaignActionResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");

  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    clientId: formData.get("clientId"),
    newClientName: formData.get("newClientName"),
    newSettlementMode: formData.get("newSettlementMode") || undefined,
    newRequiresPlatformSubmit: formData.get("newRequiresPlatformSubmit"),
    description: formData.get("description"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const data = parsed.data;

  if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) {
    return {
      ok: false,
      fieldErrors: { endsAt: "La fecha de fin es anterior al inicio." },
    };
  }

  if (data.clientId === "__new__" && !data.newClientName) {
    return {
      ok: false,
      fieldErrors: { newClientName: "Ponle un nombre al cliente." },
    };
  }

  const existing = await prisma.campaign.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    return { ok: false, fieldErrors: { name: "Ya existe una campaña así." } };
  }

  const client = await resolveClientId(data);
  if (!client.ok) {
    return {
      ok: false,
      fieldErrors: client.field ? { [client.field]: client.error } : undefined,
      error: client.field ? undefined : client.error,
    };
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: data.name,
      clientId: client.clientId,
      description: data.description || null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      createdBy: user.email,
    },
  });

  await recordAudit({
    entityType: "Campaign",
    entityId: campaign.id,
    action: "CREATED",
    actor: user,
    metadata: { name: campaign.name, clientId: client.clientId },
  });

  revalidatePath("/campanas");
  revalidatePath("/contenidos");
  revalidatePath("/finanzas");

  return { ok: true };
}

export async function setCampaignStatus(formData: FormData) {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (status !== CAMPAIGN_STATUS.ACTIVE && status !== CAMPAIGN_STATUS.CLOSED) {
    return;
  }

  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status },
  });

  await recordAudit({
    entityType: "Campaign",
    entityId: campaign.id,
    action: status === CAMPAIGN_STATUS.CLOSED ? "CLOSED" : "REOPENED",
    actor: user,
  });

  revalidatePath("/campanas");
  revalidatePath("/contenidos");
}

export async function deleteCampaign(formData: FormData) {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { deliverables: { select: { id: true } } },
  });

  // Con contenidos dentro no se borra: se cierra, para no perder la agrupación.
  if (!campaign || campaign.deliverables.length > 0) {
    return;
  }

  await prisma.campaign.delete({ where: { id: campaignId } });

  await recordAudit({
    entityType: "Campaign",
    entityId: campaignId,
    action: "DELETED",
    actor: user,
    metadata: { name: campaign.name },
  });

  revalidatePath("/campanas");
}
