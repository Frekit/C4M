"use server";

import { revalidatePath } from "next/cache";

import { upsertRosterCreator } from "@/app/creators/roster-actions";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { campaignForClient } from "@/lib/domain/client-campaign";
import { costPerContentUsdCents } from "@/lib/domain/contract-math";
import { createContract } from "@/lib/domain/contracts";
import {
  CAMPAIGN_TALENT_STATUS,
  CONTRACT_KIND,
  CONTRACT_STATUS,
  type CampaignTalentStatus,
} from "@/lib/domain/enums";
import { isCampaignTalentStatus } from "@/lib/domain/campaign-talent";
import { resolveFxRate } from "@/lib/domain/fx";
import { isSupportedCurrency } from "@/lib/currencies";
import { parseAmountToMinorUnits } from "@/lib/money";
import { extractInstagramHandle } from "@/lib/domain/validation";

export type CampaignRosterResult = {
  ok: boolean;
  error?: string;
};

function revalidateCampaign(campaignId: string, creatorId?: string) {
  revalidatePath("/campanas");
  revalidatePath(`/campanas/${campaignId}`);
  revalidatePath("/creators");
  if (creatorId) revalidatePath(`/creators/${creatorId}`);
}

export async function addTalentToCampaign(
  _prev: CampaignRosterResult | null,
  formData: FormData
): Promise<CampaignRosterResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const handle = extractInstagramHandle(String(formData.get("instagram") ?? ""));

  if (!campaignId || !handle) {
    return { ok: false, error: "Falta la campaña o el Instagram." };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) return { ok: false, error: "Esa campaña no existe." };

  const { creator } = await upsertRosterCreator({
    handle,
    country: String(formData.get("country") ?? "").trim() || null,
    profileType: String(formData.get("profileType") ?? "").trim() || null,
    createdBy: user.email,
  });

  await prisma.campaignTalent.upsert({
    where: {
      campaignId_creatorId: { campaignId, creatorId: creator.id },
    },
    create: {
      campaignId,
      creatorId: creator.id,
      status: CAMPAIGN_TALENT_STATUS.ROSTER,
      createdBy: user.email,
    },
    update: {},
  });

  await recordAudit({
    entityType: "CampaignTalent",
    entityId: `${campaignId}:${creator.id}`,
    action: "ROSTER_ADDED",
    actor: user,
    metadata: { handle, campaignId },
  });

  revalidateCampaign(campaignId, creator.id);
  return { ok: true };
}

export async function setCampaignTalentStatus(formData: FormData) {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const id = String(formData.get("talentId") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !isCampaignTalentStatus(status)) {
    throw new Error("Estado no válido.");
  }

  const row = await prisma.campaignTalent.update({
    where: { id },
    data: { status },
  });

  await recordAudit({
    entityType: "CampaignTalent",
    entityId: id,
    action: "STATUS_CHANGED",
    actor: user,
    metadata: { status, campaignId: row.campaignId },
  });

  revalidateCampaign(row.campaignId, row.creatorId);
}

export async function saveCampaignTalentPrices(
  _prev: CampaignRosterResult | null,
  formData: FormData
): Promise<CampaignRosterResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const id = String(formData.get("talentId") ?? "");
  const saleUsd = String(formData.get("saleUsd") ?? "").trim();
  const cost = String(formData.get("cost") ?? "").trim();
  const currency = String(formData.get("currency") ?? "EUR")
    .trim()
    .toUpperCase();

  if (!id) return { ok: false, error: "Falta el perfil." };
  if (!isSupportedCurrency(currency)) {
    return { ok: false, error: `Moneda ${currency} no soportada.` };
  }

  const salePriceCentsPerContent = saleUsd
    ? parseAmountToMinorUnits(saleUsd, "USD")
    : null;
  const costMinorPerContent = cost
    ? parseAmountToMinorUnits(cost, currency)
    : null;

  if (saleUsd && salePriceCentsPerContent === null) {
    return { ok: false, error: "Revisa el precio de venta (USD)." };
  }
  if (cost && costMinorPerContent === null) {
    return { ok: false, error: "Revisa el coste del creator." };
  }

  const row = await prisma.campaignTalent.update({
    where: { id },
    data: {
      salePriceCentsPerContent,
      costMinorPerContent,
      costCurrency: costMinorPerContent !== null ? currency : null,
      status: CAMPAIGN_TALENT_STATUS.PROPOSED,
    },
  });

  await recordAudit({
    entityType: "CampaignTalent",
    entityId: id,
    action: "PRICES_SET",
    actor: user,
    metadata: { campaignId: row.campaignId },
  });

  revalidateCampaign(row.campaignId, row.creatorId);
  return { ok: true };
}

export async function activateCampaignTalent(formData: FormData) {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const id = String(formData.get("talentId") ?? "");
  const deliverableCount = Number.parseInt(
    String(formData.get("deliverableCount") ?? "1"),
    10
  );

  const row = await prisma.campaignTalent.findUnique({
    where: { id },
    include: {
      campaign: true,
      creator: {
        include: {
          contracts: {
            where: { status: { not: CONTRACT_STATUS.CANCELLED } },
            select: { id: true, clientId: true },
          },
        },
      },
    },
  });

  if (!row) throw new Error("Ese perfil no está en la campaña.");
  if (!row.campaign.clientId) {
    throw new Error("La campaña no tiene cliente. Asígnalo antes de activar.");
  }
  if (
    row.salePriceCentsPerContent == null ||
    row.costMinorPerContent == null ||
    !row.costCurrency
  ) {
    throw new Error("Guarda venta y coste antes de activar.");
  }
  if (!Number.isFinite(deliverableCount) || deliverableCount < 1) {
    throw new Error("Las piezas tienen que ser ≥ 1.");
  }

  const alreadyOnClient = row.creator.contracts.some(
    (contract) => contract.clientId === row.campaign.clientId
  );
  if (alreadyOnClient) {
    await prisma.campaignTalent.update({
      where: { id },
      data: { status: CAMPAIGN_TALENT_STATUS.ACTIVE },
    });
    revalidateCampaign(row.campaignId, row.creatorId);
    return;
  }

  const matched = await campaignForClient(row.campaignId, row.campaign.clientId);
  if (!matched.ok) throw new Error(matched.error);

  const fx = await resolveFxRate(row.costCurrency);
  if (fx.unitsPerUsd <= 0) {
    throw new Error(`No hay tipo de cambio para ${row.costCurrency}.`);
  }

  const contract = await createContract({
    creatorId: row.creatorId,
    kind: CONTRACT_KIND.ORIGINAL,
    clientId: row.campaign.clientId,
    campaignId: matched.campaignId,
    economics: {
      deliverableCount,
      salePriceCentsPerContent: row.salePriceCentsPerContent,
      costCurrency: row.costCurrency,
      costMinorPerContent: row.costMinorPerContent,
      costUsdCentsPerContent: costPerContentUsdCents(
        row.costMinorPerContent,
        row.costCurrency,
        fx.unitsPerUsd
      ),
      fxUnitsPerUsd: fx.unitsPerUsd,
      fxRateAt: fx.rateAt,
      fxSource: fx.source,
      paymentTermDays: 30,
    },
    createdBy: user.email,
  });

  await prisma.campaignTalent.update({
    where: { id },
    data: { status: CAMPAIGN_TALENT_STATUS.ACTIVE },
  });

  await recordAudit({
    entityType: "Contract",
    entityId: contract.id,
    action: "CREATED",
    actor: user,
    metadata: {
      from: "campaign-talent",
      campaignId: row.campaignId,
      handle: row.creator.handle,
    },
  });

  revalidatePath("/contratos");
  revalidatePath("/contenidos");
  revalidateCampaign(row.campaignId, row.creatorId);
}
