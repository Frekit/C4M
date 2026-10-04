"use server";

import { revalidatePath } from "next/cache";

import { upsertRosterCreator } from "@/app/creators/roster-actions";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import {
  OPEN_TALENT_STATUSES,
  canActivateLine,
  canSendLineInWave,
  lineQuoteComplete,
  policyFromCampaign,
  statusAfterSavingQuote,
} from "@/lib/domain/campaign-desk";
import { campaignForClient } from "@/lib/domain/client-campaign";
import { costPerContentUsdCents } from "@/lib/domain/contract-math";
import { createContract, markParentRenewed } from "@/lib/domain/contracts";
import {
  CAMPAIGN_APPROVAL,
  CAMPAIGN_TALENT_STATUS,
  CONTRACT_KIND,
  CONTRACT_STATUS,
  PROPOSAL_STATUS,
} from "@/lib/domain/enums";
import { isCampaignTalentStatus } from "@/lib/domain/campaign-talent";
import { resolveFxRate } from "@/lib/domain/fx";
import { isSupportedCurrency } from "@/lib/currencies";
import { parseAmountToMinorUnits } from "@/lib/money";
import { extractInstagramHandle } from "@/lib/domain/validation";
import {
  loadRosterCatalog,
  resolveRosterFields,
} from "@/lib/domain/roster-catalog";

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

  const resolved = resolveRosterFields(await loadRosterCatalog(), {
    country: String(formData.get("country") ?? "").trim() || null,
    profileType: String(formData.get("profileType") ?? "").trim() || null,
  });
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const { creator } = await upsertRosterCreator({
    handle,
    country: resolved.country,
    profileType: resolved.profileType,
    createdBy: user.email,
  });

  const open = await prisma.campaignTalent.findFirst({
    where: {
      campaignId,
      creatorId: creator.id,
      status: { in: [...OPEN_TALENT_STATUSES] },
    },
  });

  if (!open) {
    await prisma.campaignTalent.create({
      data: {
        campaignId,
        creatorId: creator.id,
        status: CAMPAIGN_TALENT_STATUS.ROSTER,
        costMinorPerContent: creator.defaultCostMinor,
        costCurrency: creator.defaultCostCurrency,
        createdBy: user.email,
      },
    });
  }

  await recordAudit({
    entityType: "CampaignTalent",
    entityId: `${campaignId}:${creator.id}`,
    action: "ROSTER_ADDED",
    actor: user,
    metadata: { handle, campaignId, reused: Boolean(open) },
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

  const current = await prisma.campaignTalent.findUnique({
    where: { id },
    include: { campaign: true },
  });
  if (!current) throw new Error("Esa línea no existe.");

  const policy = policyFromCampaign(current.campaign);
  if (
    (status === CAMPAIGN_TALENT_STATUS.APPROVED ||
      status === CAMPAIGN_TALENT_STATUS.REJECTED) &&
    policy.approvalMode !== CAMPAIGN_APPROVAL.CLIENT_APPROVES
  ) {
    throw new Error("Esta campaña es de uso interno: no hay ok de cliente.");
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
  const piecesRaw = String(formData.get("deliverableCount") ?? "").trim();
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
  const deliverableCount = piecesRaw
    ? Number.parseInt(piecesRaw, 10)
    : null;

  if (saleUsd && salePriceCentsPerContent === null) {
    return { ok: false, error: "Revisa el precio de venta (USD)." };
  }
  if (cost && costMinorPerContent === null) {
    return { ok: false, error: "Revisa el coste del creator." };
  }
  if (piecesRaw && (!deliverableCount || deliverableCount < 1)) {
    return { ok: false, error: "Las piezas tienen que ser ≥ 1." };
  }

  const existing = await prisma.campaignTalent.findUnique({
    where: { id },
    include: { creator: true },
  });
  if (!existing) return { ok: false, error: "Esa línea no existe." };

  const quote = {
    status: existing.status,
    salePriceCentsPerContent,
    costMinorPerContent,
    costCurrency: costMinorPerContent !== null ? currency : null,
    deliverableCount,
  };

  const row = await prisma.campaignTalent.update({
    where: { id },
    data: {
      salePriceCentsPerContent,
      costMinorPerContent,
      costCurrency: quote.costCurrency,
      deliverableCount,
      status:
        existing.status === CAMPAIGN_TALENT_STATUS.ACTIVE
          ? existing.status
          : statusAfterSavingQuote(lineQuoteComplete(quote)),
    },
  });

  if (
    costMinorPerContent != null &&
    !existing.creator.defaultCostMinor
  ) {
    await prisma.creator.update({
      where: { id: existing.creatorId },
      data: {
        defaultCostMinor: costMinorPerContent,
        defaultCostCurrency: currency,
      },
    });
  }

  await recordAudit({
    entityType: "CampaignTalent",
    entityId: id,
    action: "QUOTE_SET",
    actor: user,
    metadata: { campaignId: row.campaignId },
  });

  revalidateCampaign(row.campaignId, row.creatorId);
  return { ok: true };
}

export async function activateCampaignTalent(formData: FormData) {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const id = String(formData.get("talentId") ?? "");

  const row = await prisma.campaignTalent.findUnique({
    where: { id },
    include: {
      campaign: true,
      creator: true,
    },
  });

  if (!row) throw new Error("Ese perfil no está en la campaña.");
  if (!row.campaign.clientId) {
    throw new Error("La campaña no tiene cliente. Asígnalo antes de activar.");
  }

  const siblings = await prisma.campaignTalent.findMany({
    where: { campaignId: row.campaignId, id: { not: row.id } },
  });
  const policy = policyFromCampaign(row.campaign);
  const gate = canActivateLine(row, policy, siblings);
  if (!gate.ok) throw new Error(gate.error);

  const deliverableCount = row.deliverableCount ?? 1;
  const matched = await campaignForClient(row.campaignId, row.campaign.clientId);
  if (!matched.ok) throw new Error(matched.error);

  const fx = await resolveFxRate(row.costCurrency ?? "EUR");
  if (fx.unitsPerUsd <= 0) {
    throw new Error(`No hay tipo de cambio para ${row.costCurrency}.`);
  }

  const parent = await prisma.contract.findFirst({
    where: {
      creatorId: row.creatorId,
      clientId: row.campaign.clientId,
      status: { not: CONTRACT_STATUS.CANCELLED },
    },
    orderBy: { createdAt: "desc" },
  });

  const sameCost =
    parent &&
    parent.costMinorPerContent === row.costMinorPerContent &&
    parent.costCurrency === row.costCurrency &&
    parent.salePriceCentsPerContent === row.salePriceCentsPerContent;

  const kind = !parent
    ? CONTRACT_KIND.ORIGINAL
    : sameCost
      ? CONTRACT_KIND.ANNEX
      : CONTRACT_KIND.RENEWAL;

  const contract = await createContract({
    creatorId: row.creatorId,
    kind,
    parent,
    clientId: row.campaign.clientId,
    campaignId: matched.campaignId,
    economics: {
      deliverableCount,
      salePriceCentsPerContent: row.salePriceCentsPerContent ?? 0,
      costCurrency: row.costCurrency ?? "EUR",
      costMinorPerContent: row.costMinorPerContent ?? 0,
      costUsdCentsPerContent: costPerContentUsdCents(
        row.costMinorPerContent ?? 0,
        row.costCurrency ?? "EUR",
        fx.unitsPerUsd
      ),
      fxUnitsPerUsd: fx.unitsPerUsd,
      fxRateAt: fx.rateAt,
      fxSource: fx.source,
      paymentTermDays: policy.defaultPaymentTermDays,
    },
    createdBy: user.email,
  });

  if (parent) {
    await markParentRenewed(parent.id, kind);
  }

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
      kind,
      campaignId: row.campaignId,
      handle: row.creator.handle,
    },
  });

  revalidatePath("/contratos");
  revalidatePath("/contenidos");
  revalidateCampaign(row.campaignId, row.creatorId);
}

export async function createCampaignProposal(
  _prev: CampaignRosterResult | null,
  formData: FormData
): Promise<CampaignRosterResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!campaignId) return { ok: false, error: "Falta la campaña." };
  if (title.length < 2) return { ok: false, error: "Ponle un nombre a la oleada." };

  await prisma.campaignProposal.create({
    data: {
      campaignId,
      title,
      status: PROPOSAL_STATUS.DRAFT,
      createdBy: user.email,
    },
  });

  await recordAudit({
    entityType: "CampaignProposal",
    entityId: campaignId,
    action: "CREATED",
    actor: user,
    metadata: { title },
  });

  revalidateCampaign(campaignId);
  return { ok: true };
}

export async function addTalentToProposal(formData: FormData) {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const talentId = String(formData.get("talentId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  if (!talentId || !proposalId) throw new Error("Falta la oleada o la línea.");

  const [talent, proposal] = await Promise.all([
    prisma.campaignTalent.findUnique({ where: { id: talentId } }),
    prisma.campaignProposal.findUnique({ where: { id: proposalId } }),
  ]);
  if (!talent || !proposal || talent.campaignId !== proposal.campaignId) {
    throw new Error("Esa línea no es de esta oleada.");
  }
  if (proposal.status !== PROPOSAL_STATUS.DRAFT) {
    throw new Error("Esa oleada ya se envió.");
  }
  if (!canSendLineInWave(talent)) {
    throw new Error("La línea tiene que estar lista (piezas y precios).");
  }

  await prisma.campaignTalent.update({
    where: { id: talentId },
    data: { proposalId },
  });

  await recordAudit({
    entityType: "CampaignProposal",
    entityId: proposalId,
    action: "LINE_ADDED",
    actor: user,
    metadata: { talentId },
  });

  revalidateCampaign(talent.campaignId, talent.creatorId);
}

export async function sendCampaignProposal(formData: FormData) {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const proposalId = String(formData.get("proposalId") ?? "");
  const proposal = await prisma.campaignProposal.findUnique({
    where: { id: proposalId },
    include: { campaign: true, talents: true },
  });
  if (!proposal) throw new Error("Esa oleada no existe.");
  if (proposal.status !== PROPOSAL_STATUS.DRAFT) {
    throw new Error("Esa oleada ya no está en borrador.");
  }
  if (proposal.talents.length === 0) {
    throw new Error("Mete al menos un perfil listo.");
  }

  const policy = policyFromCampaign(proposal.campaign);
  if (policy.approvalMode !== CAMPAIGN_APPROVAL.CLIENT_APPROVES) {
    throw new Error("Esta campaña es interna: no se envía al cliente.");
  }

  await prisma.$transaction([
    prisma.campaignProposal.update({
      where: { id: proposalId },
      data: { status: PROPOSAL_STATUS.SENT, sentAt: new Date() },
    }),
    prisma.campaignTalent.updateMany({
      where: { proposalId },
      data: { status: CAMPAIGN_TALENT_STATUS.PROPOSED },
    }),
  ]);

  await recordAudit({
    entityType: "CampaignProposal",
    entityId: proposalId,
    action: "SENT",
    actor: user,
    metadata: { count: proposal.talents.length },
  });

  revalidateCampaign(proposal.campaignId);
}
