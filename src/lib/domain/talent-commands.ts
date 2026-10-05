import type { AppUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { campaignForClient } from "@/lib/domain/client-campaign";
import { costPerContentUsdCents } from "@/lib/domain/contract-math";
import { createContract, markParentRenewed } from "@/lib/domain/contracts";
import {
  canActivateLine,
  canMarkClientDecision,
  isClientDecisionStatus,
  lineQuoteComplete,
  policyFromCampaign,
  quoteIsFrozen,
  statusAfterSavingQuote,
} from "@/lib/domain/campaign-desk";
import {
  CAMPAIGN_APPROVAL,
  CAMPAIGN_TALENT_STATUS,
  CONTRACT_KIND,
  CONTRACT_STATUS,
} from "@/lib/domain/enums";
import {
  isCostFormat,
  isCostPlatform,
  perContentFromPackage,
} from "@/lib/domain/creator-cost-quote";
import { resolveFxRate } from "@/lib/domain/fx";
import { isSupportedCurrency } from "@/lib/currencies";
import {
  AMBIGUOUS_AMOUNT_ERROR,
  ambiguousAmount,
  parseAgentAmount,
  parseAmountToMinorUnits,
} from "@/lib/money";

export type TalentCommandResult = {
  ok: boolean;
  error?: string;
  campaignId?: string;
  creatorId?: string;
  unchanged?: boolean;
  contractId?: string;
  contractCode?: string;
  handle?: string;
};

export type AgentQuoteInput = {
  saleUsd?: string;
  cost?: string;
  currency?: string;
  deliverableCount?: string;
  contentPlatform?: string;
  contentFormat?: string;
};

type StoredQuote = {
  status: string;
  salePriceCentsPerContent: number | null;
  costMinorPerContent: number | null;
  costCurrency: string | null;
  deliverableCount: number | null;
  contentPlatform: string | null;
  contentFormat: string | null;
  packageCostMinor: number | null;
};

export type ResolvedQuote = {
  salePriceCentsPerContent: number | null;
  costMinorPerContent: number | null;
  costCurrency: string | null;
  deliverableCount: number | null;
  contentPlatform: string | null;
  contentFormat: string | null;
  packageCostMinor: number | null;
};

function amountOrError(raw: string, currency: string, label: string) {
  if (ambiguousAmount(raw, currency)) {
    return { ok: false as const, error: `${label}: ${AMBIGUOUS_AMOUNT_ERROR}` };
  }
  const parsed = parseAgentAmount(raw, currency);
  if (parsed === null) return { ok: false as const, error: `Revisa ${label.toLowerCase()}.` };
  return { ok: true as const, value: parsed };
}

/** Lo que el agente va a guardar: lo omitido se queda como está en la fila. */
export function resolveMergedQuote(
  existing: StoredQuote,
  input: AgentQuoteInput
): { ok: true; quote: ResolvedQuote } | { ok: false; error: string } {
  const sentSale = input.saleUsd?.trim() ?? "";
  const sentCost = input.cost?.trim() ?? "";
  const sentPieces = input.deliverableCount?.trim() ?? "";
  const sentCurrency = input.currency?.trim().toUpperCase() ?? "";
  const sentPlatform = (input.contentPlatform ?? "").trim().toUpperCase();
  const sentFormat = (input.contentFormat ?? "").trim();

  let sale = existing.salePriceCentsPerContent;
  if (sentSale) {
    const parsed = amountOrError(sentSale, "USD", "La venta");
    if (!parsed.ok) return parsed;
    sale = parsed.value;
  }

  const currency = sentCost
    ? sentCurrency || existing.costCurrency || "EUR"
    : existing.costCurrency;
  if (currency && !isSupportedCurrency(currency)) {
    return { ok: false, error: `Moneda ${currency} no soportada.` };
  }

  let cost = existing.costMinorPerContent;
  if (sentCost) {
    const parsed = amountOrError(sentCost, currency || "EUR", "El coste");
    if (!parsed.ok) return parsed;
    cost = parsed.value;
  }

  let pieces = existing.deliverableCount;
  if (sentPieces) {
    const count = Number.parseInt(sentPieces, 10);
    if (!count || count < 1) {
      return { ok: false, error: "Las piezas tienen que ser ≥ 1." };
    }
    pieces = count;
  }

  let contentPlatform = existing.contentPlatform;
  let contentFormat = existing.contentFormat;
  let packageCostMinor = existing.packageCostMinor;
  if (sentFormat || sentPlatform) {
    contentPlatform = sentFormat && isCostPlatform(sentPlatform) ? sentPlatform : null;
    contentFormat =
      contentPlatform && isCostFormat(contentPlatform, sentFormat) ? sentFormat : null;
    if (sentFormat && !contentFormat) {
      return { ok: false, error: "Ese formato no existe en esa red." };
    }
  }

  if (contentFormat) {
    if (!pieces) return { ok: false, error: "Pon cuántos contenidos lleva el paquete." };
    if (cost === null) return { ok: false, error: "Pon el coste del paquete." };
    if (sentCost || sentFormat || sentPlatform || sentPieces) {
      const split = perContentFromPackage(sentCost ? cost : (packageCostMinor ?? cost), pieces);
      if (!split.ok) return { ok: false, error: split.error };
      packageCostMinor = sentCost ? cost : (packageCostMinor ?? cost);
      cost = split.perContentMinor;
    }
  }

  return {
    ok: true,
    quote: {
      salePriceCentsPerContent: sale,
      costMinorPerContent: cost,
      costCurrency: cost !== null ? currency : null,
      deliverableCount: pieces,
      contentPlatform,
      contentFormat,
      packageCostMinor: contentFormat ? packageCostMinor : null,
    },
  };
}

async function applyMergedTalentQuote(
  actor: AppUser,
  input: AgentQuoteInput & { talentId: string }
): Promise<TalentCommandResult> {
  const id = input.talentId.trim();
  if (!id) return { ok: false, error: "Falta el perfil." };
  const existing = await prisma.campaignTalent.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Esa línea no existe." };
  if (quoteIsFrozen(existing.status)) {
    return {
      ok: false,
      error: "Esa línea ya se envió o se activó. La cotización no se toca.",
    };
  }

  const resolved = resolveMergedQuote(existing, input);
  if (!resolved.ok) return resolved;
  const quote = resolved.quote;

  const changed = await prisma.campaignTalent.updateMany({
    where: {
      id,
      status: {
        in: [CAMPAIGN_TALENT_STATUS.ROSTER, CAMPAIGN_TALENT_STATUS.READY],
      },
    },
    data: {
      ...quote,
      status: statusAfterSavingQuote(
        lineQuoteComplete({ status: existing.status, ...quote })
      ),
    },
  });
  if (changed.count !== 1) {
    return {
      ok: false,
      error: "Esa línea ya se envió o se activó. La cotización no se toca.",
    };
  }

  await recordAudit({
    entityType: "CampaignTalent",
    entityId: id,
    action: "QUOTE_SET",
    actor,
    metadata: { campaignId: existing.campaignId, merge: true },
  });

  return {
    ok: true,
    campaignId: existing.campaignId,
    creatorId: existing.creatorId,
  };
}

export async function applyTalentQuote(
  actor: AppUser,
  input: {
    talentId: string;
    saleUsd?: string;
    cost?: string;
    currency?: string;
    deliverableCount?: string;
    contentPlatform?: string;
    contentFormat?: string;
  },
  options?: { merge?: boolean }
): Promise<TalentCommandResult> {
  if (options?.merge) return applyMergedTalentQuote(actor, input);
  const id = input.talentId.trim();
  const saleUsd = input.saleUsd?.trim() ?? "";
  const cost = input.cost?.trim() ?? "";
  const piecesRaw = input.deliverableCount?.trim() ?? "";
  const currency = (input.currency?.trim() || "EUR").toUpperCase();

  if (!id) return { ok: false, error: "Falta el perfil." };
  if (!isSupportedCurrency(currency)) {
    return { ok: false, error: `Moneda ${currency} no soportada.` };
  }

  const platformRaw = (input.contentPlatform ?? "").trim().toUpperCase();
  const formatRaw = (input.contentFormat ?? "").trim();
  const contentPlatform =
    formatRaw && isCostPlatform(platformRaw) ? platformRaw : null;
  const contentFormat =
    contentPlatform && isCostFormat(contentPlatform, formatRaw) ? formatRaw : null;
  if (formatRaw && !contentFormat) {
    return { ok: false, error: "Ese formato no existe en esa red." };
  }

  const salePriceCentsPerContent = saleUsd
    ? parseAmountToMinorUnits(saleUsd, "USD")
    : null;
  const costAmount = cost ? parseAmountToMinorUnits(cost, currency) : null;
  const deliverableCount = piecesRaw ? Number.parseInt(piecesRaw, 10) : null;

  if (saleUsd && salePriceCentsPerContent === null) {
    return { ok: false, error: "Revisa el precio de venta (USD)." };
  }
  if (cost && costAmount === null) {
    return { ok: false, error: "Revisa el coste del creator." };
  }
  if (piecesRaw && (!deliverableCount || deliverableCount < 1)) {
    return { ok: false, error: "Las piezas tienen que ser ≥ 1." };
  }

  let packageCostMinor: number | null = null;
  let costMinorPerContent = costAmount;
  if (contentFormat) {
    if (!deliverableCount) {
      return { ok: false, error: "Pon cuántos contenidos lleva el paquete." };
    }
    if (costAmount === null) {
      return { ok: false, error: "Pon el coste del paquete." };
    }
    const split = perContentFromPackage(costAmount, deliverableCount);
    if (!split.ok) return { ok: false, error: split.error };
    packageCostMinor = costAmount;
    costMinorPerContent = split.perContentMinor;
  }

  const existing = await prisma.campaignTalent.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Esa línea no existe." };
  if (quoteIsFrozen(existing.status)) {
    return {
      ok: false,
      error: "Esa línea ya se envió o se activó. La cotización no se toca.",
    };
  }

  const quote = {
    status: existing.status,
    salePriceCentsPerContent,
    costMinorPerContent,
    costCurrency: costMinorPerContent !== null ? currency : null,
    deliverableCount,
  };

  const changed = await prisma.campaignTalent.updateMany({
    where: {
      id,
      status: {
        in: [CAMPAIGN_TALENT_STATUS.ROSTER, CAMPAIGN_TALENT_STATUS.READY],
      },
    },
    data: {
      salePriceCentsPerContent,
      costMinorPerContent,
      costCurrency: quote.costCurrency,
      deliverableCount,
      contentPlatform,
      contentFormat,
      packageCostMinor,
      status: statusAfterSavingQuote(lineQuoteComplete(quote)),
    },
  });
  if (changed.count !== 1) {
    return {
      ok: false,
      error: "Esa línea ya se envió o se activó. La cotización no se toca.",
    };
  }

  await recordAudit({
    entityType: "CampaignTalent",
    entityId: id,
    action: "QUOTE_SET",
    actor,
    metadata: { campaignId: existing.campaignId },
  });

  return {
    ok: true,
    campaignId: existing.campaignId,
    creatorId: existing.creatorId,
  };
}

export async function applyClientTalentStatus(
  actor: AppUser,
  input: { talentId: string; status: string }
): Promise<TalentCommandResult> {
  const id = input.talentId.trim();
  const status = input.status.trim();

  if (!id || !isClientDecisionStatus(status)) {
    return {
      ok: false,
      error: "Solo se puede aprobar o rechazar una línea ya propuesta.",
    };
  }

  const current = await prisma.campaignTalent.findUnique({
    where: { id },
    include: { campaign: true },
  });
  if (!current) return { ok: false, error: "Esa línea no existe." };

  const policy = policyFromCampaign(current.campaign);
  if (policy.approvalMode !== CAMPAIGN_APPROVAL.CLIENT_APPROVES) {
    return { ok: false, error: "Esta campaña es de uso interno: no hay ok de cliente." };
  }
  if (!canMarkClientDecision(policy.approvalMode, current.status)) {
    return { ok: false, error: "Primero envía el perfil en una oleada." };
  }

  const changed = await prisma.campaignTalent.updateMany({
    where: {
      id,
      status: {
        in: [CAMPAIGN_TALENT_STATUS.PROPOSED, CAMPAIGN_TALENT_STATUS.APPROVED],
      },
    },
    data: { status },
  });
  if (changed.count !== 1) {
    return { ok: false, error: "Esa línea ya no admite un ok de cliente." };
  }

  await recordAudit({
    entityType: "CampaignTalent",
    entityId: id,
    action: "STATUS_CHANGED",
    actor,
    metadata: { status, campaignId: current.campaignId },
  });

  return {
    ok: true,
    campaignId: current.campaignId,
    creatorId: current.creatorId,
  };
}

export async function activateTalentLine(
  actor: AppUser,
  talentId: string
): Promise<TalentCommandResult> {
  const id = talentId.trim();
  const preview = await prisma.campaignTalent.findUnique({
    where: { id },
    include: { campaign: true, creator: true },
  });

  if (!preview) return { ok: false, error: "Ese perfil no está en la campaña." };
  if (preview.status === CAMPAIGN_TALENT_STATUS.ACTIVE) {
    return { ok: true, unchanged: true, campaignId: preview.campaignId };
  }
  if (!preview.campaign.clientId) {
    return { ok: false, error: "La campaña no tiene cliente. Asígnalo antes de activar." };
  }

  const matched = await campaignForClient(
    preview.campaignId,
    preview.campaign.clientId
  );
  if (!matched.ok) return { ok: false, error: matched.error };

  try {
    const activated = await prisma.$transaction(async (tx) => {
      const row = await tx.campaignTalent.findUnique({
        where: { id },
        include: { campaign: true, creator: true },
      });
      if (!row) throw new Error("Ese perfil no está en la campaña.");
      if (row.status === CAMPAIGN_TALENT_STATUS.ACTIVE) return null;
      if (!row.campaign.clientId) {
        throw new Error("La campaña no tiene cliente. Asígnalo antes de activar.");
      }

      const siblings = await tx.campaignTalent.findMany({
        where: { campaignId: row.campaignId, id: { not: row.id } },
      });
      const policy = policyFromCampaign(row.campaign);
      const gate = canActivateLine(row, policy, siblings);
      if (!gate.ok) throw new Error(gate.error);

      const claimed = await tx.campaignTalent.updateMany({
        where: { id, status: row.status },
        data: { status: CAMPAIGN_TALENT_STATUS.ACTIVE },
      });
      if (claimed.count !== 1) {
        throw new Error("Esa línea ya no se puede activar.");
      }

      const fx = await resolveFxRate(row.costCurrency ?? "EUR");
      if (fx.unitsPerUsd <= 0) {
        throw new Error(`No hay tipo de cambio para ${row.costCurrency}.`);
      }

      const parent = await tx.contract.findFirst({
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

      const contract = await createContract(
        {
          creatorId: row.creatorId,
          kind,
          parent,
          clientId: row.campaign.clientId,
          campaignId: matched.campaignId,
          economics: {
            deliverableCount: row.deliverableCount ?? 1,
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
          createdBy: actor.email,
        },
        tx
      );

      if (parent) {
        await markParentRenewed(parent.id, kind, tx);
      }

      return { row, contract, kind };
    });

    if (!activated) {
      return { ok: true, unchanged: true, campaignId: preview.campaignId };
    }

    await recordAudit({
      entityType: "Contract",
      entityId: activated.contract.id,
      action: "CREATED",
      actor,
      metadata: {
        from: "campaign-talent",
        kind: activated.kind,
        campaignId: activated.row.campaignId,
        handle: activated.row.creator.handle,
      },
    });

    return {
      ok: true,
      campaignId: activated.row.campaignId,
      creatorId: activated.row.creatorId,
      contractId: activated.contract.id,
      contractCode: activated.contract.code,
      handle: activated.row.creator.handle,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se ha podido crear el borrador.",
    };
  }
}
