"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { CAMPAIGN_STATUS } from "@/lib/domain/enums";
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
  clientName: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  startsAt: optionalDate,
  endsAt: optionalDate,
});

export async function createCampaign(
  _prev: CampaignActionResult | null,
  formData: FormData
): Promise<CampaignActionResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");

  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    clientName: formData.get("clientName"),
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

  const existing = await prisma.campaign.findUnique({
    where: { name: data.name },
  });

  if (existing) {
    return { ok: false, fieldErrors: { name: "Ya existe una campaña así." } };
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: data.name,
      clientName: data.clientName || null,
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
    metadata: { name: campaign.name },
  });

  revalidatePath("/campanas");
  revalidatePath("/contenidos");

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
