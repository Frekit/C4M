"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import {
  CAMPAIGN_APPROVAL,
  CAMPAIGN_ENGAGEMENT,
  CAMPAIGN_STATUS,
  CONTRACT_STATUS,
  SETTLEMENT_MODE,
  SIGNATURE_FILTER_BATCH,
} from "@/lib/domain/enums";
import {
  parsePaymentTermDays,
  requireBudgetSaleCents,
} from "@/lib/domain/campaign-desk";
import { processMailQueue } from "@/lib/domain/mail-queue";
import { queueUnsignedContracts } from "@/lib/domain/signature-send";
import { campaignSchema, fieldErrorsFrom } from "@/lib/domain/validation";

export type CampaignActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  at?: number;
};

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
    newSettlementMode: formData.get("newSettlementMode"),
    newRequiresPlatformSubmit: formData.get("newRequiresPlatformSubmit"),
    description: formData.get("description"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    engagementKind: formData.get("engagementKind"),
    approvalMode: formData.get("approvalMode"),
    budgetUsd: formData.get("budgetUsd"),
    defaultPaymentTermDays: formData.get("defaultPaymentTermDays"),
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

  const engagementKind =
    data.engagementKind || CAMPAIGN_ENGAGEMENT.ALWAYS_ON;
  const approvalMode = data.approvalMode || CAMPAIGN_APPROVAL.INTERNAL;
  const budget = requireBudgetSaleCents(engagementKind, data.budgetUsd);
  if (!budget.ok) {
    return { ok: false, fieldErrors: { budgetUsd: budget.error } };
  }
  const campaign = await prisma.campaign.create({
    data: {
      name: data.name,
      clientId: client.clientId,
      description: data.description || null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      engagementKind,
      approvalMode,
      budgetSaleCents: budget.cents,
      defaultPaymentTermDays: parsePaymentTermDays(data.defaultPaymentTermDays),
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

  return { ok: true, at: Date.now() };
}

export async function updateCampaignPolicy(
  _prev: CampaignActionResult | null,
  formData: FormData
): Promise<CampaignActionResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!campaignId) return { ok: false, error: "Falta la campaña." };

  const engagementKind = isCampaignEngagementSafe(
    String(formData.get("engagementKind") ?? "")
  )
    ? String(formData.get("engagementKind"))
    : CAMPAIGN_ENGAGEMENT.ALWAYS_ON;
  const approvalMode = isCampaignApprovalSafe(
    String(formData.get("approvalMode") ?? "")
  )
    ? String(formData.get("approvalMode"))
    : CAMPAIGN_APPROVAL.INTERNAL;

  const budget = requireBudgetSaleCents(
    engagementKind,
    String(formData.get("budgetUsd") ?? "")
  );
  if (!budget.ok) {
    return { ok: false, fieldErrors: { budgetUsd: budget.error } };
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      engagementKind,
      approvalMode,
      budgetSaleCents: budget.cents,
      defaultPaymentTermDays: parsePaymentTermDays(
        String(formData.get("defaultPaymentTermDays") ?? "")
      ),
    },
  });

  await recordAudit({
    entityType: "Campaign",
    entityId: campaignId,
    action: "POLICY_UPDATED",
    actor: user,
    metadata: { engagementKind, approvalMode },
  });

  revalidatePath("/campanas");
  revalidatePath(`/campanas/${campaignId}`);
  return { ok: true };
}

export async function setCampaignClient(
  _prev: CampaignActionResult | null,
  formData: FormData
): Promise<CampaignActionResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  if (!campaignId) return { ok: false, error: "Falta la campaña." };
  if (!clientId) return { ok: false, error: "Elige un cliente." };

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { ok: false, error: "Ese cliente no existe." };

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) return { ok: false, error: "Esa campaña no existe." };

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { clientId: client.id },
  });

  await recordAudit({
    entityType: "Campaign",
    entityId: campaignId,
    action: "CLIENT_SET",
    actor: user,
    metadata: { clientId: client.id, clientName: client.name },
  });

  revalidatePath("/campanas");
  revalidatePath(`/campanas/${campaignId}`);
  revalidatePath(`/clientes/${client.id}`);
  return { ok: true };
}

function isCampaignEngagementSafe(value: string) {
  return (
    value === CAMPAIGN_ENGAGEMENT.SLATE ||
    value === CAMPAIGN_ENGAGEMENT.BUDGET ||
    value === CAMPAIGN_ENGAGEMENT.ALWAYS_ON
  );
}

function isCampaignApprovalSafe(value: string) {
  return (
    value === CAMPAIGN_APPROVAL.INTERNAL ||
    value === CAMPAIGN_APPROVAL.CLIENT_APPROVES
  );
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
    include: { _count: { select: { deliverables: true } } },
  });

  // Con contenidos dentro no se borra: se cierra, para no perder la agrupación.
  if (!campaign || campaign._count.deliverables > 0) {
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

export type BulkSignatureResult = {
  ok: boolean;
  error?: string;
  message?: string;
  queued?: number;
  skipped?: number;
  processed?: number;
  remaining?: number;
};

export async function sendCampaignSignatures(
  _prev: BulkSignatureResult | null,
  formData: FormData
): Promise<BulkSignatureResult> {
  const user = await requirePermission("signature:send", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const expiresInDays = Number.parseInt(
    String(formData.get("expiresInDays") ?? "14"),
    10
  );
  const days =
    Number.isFinite(expiresInDays) && expiresInDays >= 1 && expiresInDays <= 90
      ? expiresInDays
      : 14;

  if (!campaignId) {
    return { ok: false, error: "Falta la campaña." };
  }

  const contracts = await prisma.contract.findMany({
    where: {
      status: { in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT] },
      deliverables: { some: { campaignId } },
    },
    take: SIGNATURE_FILTER_BATCH,
    select: { id: true },
  });

  if (contracts.length === 0) {
    return { ok: false, error: "No hay contratos pendientes de firma en esta campaña." };
  }

  const queuedReport = await queueUnsignedContracts({
    contractIds: contracts.map((contract) => contract.id),
    expiresInDays: days,
    createdBy: user.email,
  });
  const queued = queuedReport.queued;
  const skipped = queuedReport.skipped;
  const errors = queuedReport.errors;

  const mail = await processMailQueue();

  await recordAudit({
    entityType: "Campaign",
    entityId: campaignId,
    action: "SIGNATURE_BATCH",
    actor: user,
    metadata: { queued, skipped, processed: mail.processed },
  });

  revalidatePath(`/campanas/${campaignId}`);
  revalidatePath("/contratos");
  revalidatePath("/");

  const extra = errors.length > 0 ? ` ${errors.join(" ")}` : "";
  return {
    ok: true,
    queued,
    skipped,
    processed: mail.processed,
    remaining: mail.remaining,
    message: `Encolados ${queued}. Sin email o ya firmados: ${skipped}. Correo procesado ${mail.processed} (quedan ${mail.remaining}).${extra}`,
  };
}

export async function processPendingMail(
  _prev: BulkSignatureResult | null,
  _formData: FormData
): Promise<BulkSignatureResult> {
  await requirePermission("signature:send", "/campanas");
  const mail = await processMailQueue();
  revalidatePath("/campanas");
  revalidatePath("/contratos");
  return {
    ok: true,
    processed: mail.processed,
    remaining: mail.remaining,
    message:
      mail.processed === 0
        ? "No hay correos pendientes."
        : `Procesados ${mail.processed}. Enviados ${mail.sent}, copiar a mano ${mail.skipped}, fallidos ${mail.failed}. Quedan ${mail.remaining}.`,
  };
}
