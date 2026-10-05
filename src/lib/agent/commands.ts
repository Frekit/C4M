import type { AppUser } from "@/lib/auth/types";
import { can, type Permission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { loadActionCenter } from "@/lib/domain/action-center";
import { assembleBriefing } from "@/lib/domain/campaign-briefing";
import { loadCampaignResults } from "@/lib/domain/campaign-results";
import { loadCampaignSheet } from "@/lib/domain/campaign-sheet";
import { contractTotals } from "@/lib/domain/contract-math";
import { getContractDetail, syncContractCompletion } from "@/lib/domain/contracts";
import {
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
  SETTLEMENT_MODE,
  SIGNATURE_FILTER_BATCH,
} from "@/lib/domain/enums";
import { loadFinanceQueues } from "@/lib/domain/finance";
import { syncPackSettlement } from "@/lib/domain/pack-sync";
import {
  duplicatePostUrlError,
  postUrlKey,
} from "@/lib/domain/post-url";
import { searchRoster } from "@/lib/domain/roster-search";
import {
  canPublishDeliverables,
  resolveDeliverableState,
} from "@/lib/domain/rules";
import { queueUnsignedContracts } from "@/lib/domain/signature-send";
import {
  activateTalentLine,
  applyClientTalentStatus,
  applyTalentQuote,
} from "@/lib/domain/talent-commands";
import { placeCreatorOnCampaign } from "@/app/(app)/campanas/roster-actions";
import { extractInstagramHandle } from "@/lib/domain/instagram-handle";
import { buildZexelLote } from "@/lib/domain/zexel-batch";
import { formatMoney, fromMinorUnits, parseAgentAmount } from "@/lib/money";
import { Prisma } from "@prisma/client";

import { payoutTotalsLabel } from "./effect";
import { aiActorLabel } from "./config";
import { isStrictIsoDate } from "./dates";
import { boundId, type AgentRouteContext } from "./route-context";
import { untrusted } from "./trust";

export type AgentSession = {
  user: AppUser;
  context: AgentRouteContext;
};

function denied(permission: Permission, message: string) {
  return { ok: false as const, error: message, permission };
}

function aiUser(user: AppUser): AppUser {
  return { ...user, email: aiActorLabel(user.email) };
}

function assertCan(user: AppUser, permission: Permission, message: string) {
  if (!can(user.role, permission)) return denied(permission, message);
  return null;
}

export type ScopedInput = {
  campaignId?: string;
  contractId?: string;
  creatorId?: string;
  actorUserId?: string;
};

export type ToolRunOptions = {
  toolCallId: string;
  messages: unknown;
};

function assertScope(
  session: AgentSession,
  input: ScopedInput,
  requireCampaign: boolean
) {
  if (input.actorUserId !== session.user.id) {
    return { ok: false as const, error: "Esta aprobación es de otra persona." };
  }
  const campaignId = session.context.campaignId ?? "";
  const contractId = session.context.contractId ?? "";
  const creatorId = session.context.creatorId ?? "";
  if ((input.campaignId ?? "") !== campaignId) {
    return { ok: false as const, error: "Esa campaña no es la de esta pantalla." };
  }
  if ((input.contractId ?? "") !== contractId) {
    return { ok: false as const, error: "Ese contrato no es el de esta pantalla." };
  }
  if ((input.creatorId ?? "") !== creatorId) {
    return { ok: false as const, error: "Ese perfil no es el de esta pantalla." };
  }
  if (requireCampaign && !campaignId) {
    return { ok: false as const, error: "Abre la campaña antes de hacer este cambio." };
  }
  return null;
}

export function approvalIdForCall(messages: unknown, toolCallId: string) {
  if (!Array.isArray(messages) || !toolCallId) return null;
  for (const message of messages) {
    if (!message || typeof message !== "object") continue;
    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const record = part as { type?: string; approvalId?: string; toolCallId?: string };
      if (
        record.type === "tool-approval-request" &&
        record.toolCallId === toolCallId &&
        typeof record.approvalId === "string"
      ) {
        return record.approvalId;
      }
    }
  }
  return null;
}

async function claimApproval(
  session: AgentSession,
  toolName: string,
  options: ToolRunOptions
) {
  const approvalId = approvalIdForCall(options.messages, options.toolCallId);
  if (!approvalId) return { ok: false as const, error: "Falta la aprobación." };
  try {
    await prisma.agentApproval.create({
      data: { id: approvalId, userId: session.user.id, toolName },
    });
  } catch (error) {
    const code =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : "";
    if (code === "P2002") {
      return { ok: false as const, error: "Esa aprobación ya se usó." };
    }
    throw error;
  }
  return null;
}

async function beginWrite(
  session: AgentSession,
  toolName: string,
  input: ScopedInput,
  options: ToolRunOptions,
  permission: Permission,
  denial: string,
  requireCampaign: boolean
) {
  const blocked = assertCan(session.user, permission, denial);
  if (blocked) return blocked;
  const scope = assertScope(session, input, requireCampaign);
  if (scope) return scope;
  return claimApproval(session, toolName, options);
}

export async function runGetCampaignBriefing(
  session: AgentSession,
  input: { campaignId?: string }
) {
  const bound = boundId(session.context.campaignId, input.campaignId);
  if (!bound.ok) return bound;
  const [sheet, results] = await Promise.all([
    loadCampaignSheet(bound.id),
    loadCampaignResults(bound.id),
  ]);
  if (!sheet) return { ok: false as const, error: "Esa campaña no existe." };
  const packet = assembleBriefing({
    campaignName: sheet.campaign.name,
    clientName: sheet.campaign.client?.name ?? null,
    objective: sheet.campaign.briefObjective,
    audience: sheet.campaign.briefAudience,
    networks: sheet.campaign.briefNetworks,
    formats: sheet.campaign.briefFormats,
    notes: sheet.campaign.briefNotes,
    rows: sheet.rows,
    pulse: sheet.pulse,
    results,
  });
  return {
    ok: true as const,
    ...packet,
    objective: packet.objective ? untrusted(packet.objective) : packet.objective,
    audience: packet.audience ? untrusted(packet.audience) : packet.audience,
    networks: packet.networks ? untrusted(packet.networks) : packet.networks,
    formats: packet.formats ? untrusted(packet.formats) : packet.formats,
    notes: packet.notes ? untrusted(packet.notes) : packet.notes,
    onDesk: packet.onDesk.slice(0, 40),
    onDeskTruncated: packet.onDesk.length > 40,
  };
}

export async function runSearchRoster(
  _session: AgentSession,
  input: { query: string }
) {
  const rows = await searchRoster(input.query);
  return {
    ok: true as const,
    items: rows.map((row) => ({
      id: row.id,
      handle: row.handle,
      displayName: row.displayName,
      hasContactEmail: Boolean(row.contactEmail?.trim()),
    })),
  };
}

export async function runListPendingActions(session: AgentSession) {
  const firstName = session.user.name.split(" ")[0] || session.user.name;
  const center = await loadActionCenter(firstName);
  return {
    ok: true as const,
    urgentCount: center.urgentCount,
    empty: center.empty,
    cards: center.cards.slice(0, 12).map((card) => ({
      id: card.id,
      title: untrusted(card.title),
      body: untrusted(card.body),
      kind: card.kind,
      campaignId: card.campaignId ?? null,
      campaignName: card.campaignName ?? null,
      handles: card.handles,
    })),
  };
}

export async function runGetContract(
  session: AgentSession,
  input: { contractId?: string; code?: string }
) {
  const requested = input.contractId?.trim() || undefined;
  const bound = session.context.contractId
    ? boundId(session.context.contractId, requested)
    : { ok: true as const, id: requested };
  if (!bound.ok) return bound;

  const contract = bound.id
    ? await getContractDetail(bound.id)
    : input.code
      ? await prisma.contract.findUnique({
          where: { code: input.code.trim() },
          include: {
            creator: true,
            client: true,
            deliverables: {
              orderBy: { position: "asc" as const },
              include: { campaign: { include: { client: true } } },
            },
            signatureRequests: {
              orderBy: { createdAt: "desc" as const },
              omit: { documentPdf: true },
              include: { payee: true },
            },
            parent: true,
          },
        })
      : null;

  if (!contract) return { ok: false as const, error: "Ese contrato no existe." };
  if (
    session.context.campaignId &&
    !contract.deliverables.some(
      (item) => item.campaignId === session.context.campaignId
    )
  ) {
    return { ok: false as const, error: "Ese contrato no es de esta campaña." };
  }

  const totals = contractTotals(contract);
  const showEmail =
    can(session.user.role, "signature:send") ||
    can(session.user.role, "payees:read_full");

  return {
    ok: true as const,
    id: contract.id,
    code: contract.code,
    status: contract.status,
    handle: contract.creator.handle,
    hasContactEmail: Boolean(contract.creator.contactEmail?.trim()),
    contactEmail: showEmail ? contract.creator.contactEmail : null,
    clientName: contract.client?.name ?? null,
    deliverableCount: contract.deliverableCount,
    saleLabel: formatMoney(contract.salePriceCentsPerContent, "USD"),
    costLabel: formatMoney(contract.costMinorPerContent, contract.costCurrency),
    negativeMargin: totals.hasNegativeMargin,
    startsAt: contract.startsAt?.toISOString() ?? null,
    endsAt: contract.endsAt?.toISOString() ?? null,
    deliverables: contract.deliverables.map((item) => ({
      id: item.id,
      position: item.position,
      status: item.status,
      campaignId: item.campaignId,
      publishedAt: item.publishedAt?.toISOString() ?? null,
    })),
    signature: contract.signatureRequests[0]
      ? {
          status: contract.signatureRequests[0].status,
          recipientEmail: showEmail
            ? contract.signatureRequests[0].recipientEmail
            : null,
        }
      : null,
  };
}

export async function runAddToDesk(
  session: AgentSession,
  input: ScopedInput & { handle: string },
  options: ToolRunOptions
) {
  const blocked = await beginWrite(
    session,
    "addToDesk",
    input,
    options,
    "campaigns:manage",
    "Tu rol no permite meter perfiles en la mesa.",
    true
  );
  if (blocked) return blocked;
  const bound = { ok: true as const, id: input.campaignId ?? "" };
  const handle = extractInstagramHandle(input.handle);
  if (!handle) return { ok: false as const, error: "Ese handle no es válido." };

  const campaign = await prisma.campaign.findUnique({
    where: { id: bound.id },
    select: { id: true, name: true },
  });
  if (!campaign) return { ok: false as const, error: "Esa campaña no existe." };

  const creator = await prisma.creator.findFirst({
    where: { handle },
    select: { id: true, handle: true },
  });
  if (!creator) {
    return {
      ok: false as const,
      error: `No existe @${handle}. No doy de alta perfiles que no están en el roster.`,
    };
  }

  const placed = await placeCreatorOnCampaign(
    campaign.id,
    creator.id,
    aiActorLabel(session.user.email)
  );
  if (!placed) {
    return { ok: false as const, error: `@${creator.handle} ya está en la mesa.` };
  }

  await recordAudit({
    entityType: "CampaignTalent",
    entityId: campaign.id,
    action: "ROSTER_ADDED",
    actor: aiUser(session.user),
    metadata: { campaignId: campaign.id, handle: creator.handle, added: 1 },
  });

  return {
    ok: true as const,
    campaignId: campaign.id,
    campaignName: campaign.name,
    handle: creator.handle,
  };
}

async function talentInContext(session: AgentSession, talentId: string) {
  if (!session.context.campaignId) {
    return { ok: false as const, error: "Abre la campaña antes de hacer este cambio." };
  }
  const line = await prisma.campaignTalent.findUnique({
    where: { id: talentId },
    select: { campaignId: true },
  });
  if (!line) return { ok: false as const, error: "Esa línea no existe." };
  if (line.campaignId !== session.context.campaignId) {
    return { ok: false as const, error: "Esa línea no es de esta campaña." };
  }
  return null;
}

export async function runSetLinePrice(
  session: AgentSession,
  input: ScopedInput & {
    talentId: string;
    saleUsd?: string;
    cost?: string;
    currency?: string;
    deliverableCount?: string;
    contentPlatform?: string;
    contentFormat?: string;
  },
  options: ToolRunOptions
) {
  const blocked = await beginWrite(
    session,
    "setLinePrice",
    input,
    options,
    "campaigns:manage",
    "Tu rol no permite cambiar precios de la planilla.",
    true
  );
  if (blocked) return blocked;
  const scope = await talentInContext(session, input.talentId);
  if (scope) return scope;
  return applyTalentQuote(aiUser(session.user), input, { merge: true });
}

export async function runSetTalentStatus(
  session: AgentSession,
  input: ScopedInput & { talentId: string; status: string },
  options: ToolRunOptions
) {
  const blocked = await beginWrite(
    session,
    "setTalentStatus",
    input,
    options,
    "campaigns:manage",
    "Tu rol no permite cambiar el estado de un perfil.",
    true
  );
  if (blocked) return blocked;
  if (input.status === "ACTIVE") {
    return {
      ok: false as const,
      error: "Activar crea el contrato. Usa createDraftContract.",
    };
  }
  const scope = await talentInContext(session, input.talentId);
  if (scope) return scope;
  return applyClientTalentStatus(aiUser(session.user), input);
}

export async function runCreateDraftContract(
  session: AgentSession,
  input: ScopedInput & { talentId: string },
  options: ToolRunOptions
) {
  const blocked = await beginWrite(
    session,
    "createDraftContract",
    input,
    options,
    "contracts:write",
    "Tu rol no permite crear contratos.",
    true
  );
  if (blocked) return blocked;
  const scope = await talentInContext(session, input.talentId);
  if (scope) return scope;
  return activateTalentLine(aiUser(session.user), input.talentId);
}

export async function runMarkPublished(
  session: AgentSession,
  input: ScopedInput & { deliverableId: string; contentDate: string; postUrl: string },
  options: ToolRunOptions
) {
  const blocked = await beginWrite(
    session,
    "markPublished",
    input,
    options,
    "deliverables:publish",
    "Tu rol no permite marcar contenidos como publicados.",
    false
  );
  if (blocked) return blocked;

  const deliverable = await prisma.deliverable.findUnique({
    where: { id: input.deliverableId },
    include: {
      contract: { include: { client: true, creator: true } },
      campaign: { include: { client: true } },
    },
  });
  if (!deliverable) return { ok: false as const, error: "Ese contenido no existe." };
  if (
    session.context.campaignId &&
    deliverable.campaignId !== session.context.campaignId
  ) {
    return { ok: false as const, error: "Ese contenido no es de esta campaña." };
  }
  if (session.context.contractId && deliverable.contractId !== session.context.contractId) {
    return { ok: false as const, error: "Ese contenido no es de este contrato." };
  }
  if (!isStrictIsoDate(input.contentDate)) {
    return { ok: false as const, error: "Fecha no válida." };
  }
  if (deliverable.status === DELIVERABLE_STATUS.SUBMITTED) {
    return {
      ok: false as const,
      error: "Este contenido ya está en la plataforma del cliente. Lo toca Finanzas.",
    };
  }
  if (!canPublishDeliverables(deliverable.contract.status)) {
    return {
      ok: false as const,
      error: "Este contrato está cancelado; no se pueden marcar contenidos como publicados.",
    };
  }

  const contentDate = new Date(`${input.contentDate}T00:00:00.000Z`);
  if (Number.isNaN(contentDate.getTime())) {
    return { ok: false as const, error: "Fecha no válida." };
  }

  const policy = deliverable.campaign?.client ?? deliverable.contract.client ?? null;
  const resolved = resolveDeliverableState({
    status: DELIVERABLE_STATUS.PUBLISHED,
    previousStatus: deliverable.status,
    contentDate,
    postUrl: input.postUrl,
    paymentTermDays: deliverable.contract.paymentTermDays,
    deferPayment: policy?.settlementMode === SETTLEMENT_MODE.PACK,
  });
  if (!resolved.ok) return { ok: false as const, error: resolved.error };

  const nextPostUrl = input.postUrl.trim();
  const nextPostUrlKey = postUrlKey(nextPostUrl);
  if (nextPostUrlKey) {
    const taken = await prisma.deliverable.findFirst({
      where: { postUrlKey: nextPostUrlKey, id: { not: deliverable.id } },
      include: {
        contract: { include: { creator: { select: { handle: true } } } },
      },
    });
    if (taken) {
      return { ok: false as const, error: duplicatePostUrlError({ ...taken, title: taken.title }) };
    }
  }

  try {
    await prisma.deliverable.update({
      where: { id: deliverable.id },
      data: {
        postUrl: nextPostUrl,
        postUrlKey: nextPostUrlKey,
        ...resolved.value,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false as const, error: "Ese enlace ya está en otro contenido." };
    }
    throw error;
  }

  await syncContractCompletion(deliverable.contractId);
  if (deliverable.campaignId) {
    await syncPackSettlement({
      campaignId: deliverable.campaignId,
      creatorId: deliverable.contract.creatorId,
    });
  }

  await recordAudit({
    entityType: "Deliverable",
    entityId: deliverable.id,
    action: "UPDATED",
    actor: aiUser(session.user),
    metadata: {
      contractCode: deliverable.contract.code,
      position: deliverable.position,
      status: resolved.value.status,
      publishedAt: resolved.value.publishedAt?.toISOString() ?? null,
    },
  });

  return {
    ok: true as const,
    deliverableId: deliverable.id,
    handle: deliverable.contract.creator.handle,
    status: resolved.value.status,
  };
}

export async function runQueueSignatures(
  session: AgentSession,
  input: ScopedInput & { contractIds?: string[]; expiresInDays?: number },
  options: ToolRunOptions
) {
  const blocked = await beginWrite(
    session,
    "queueSignatures",
    input,
    options,
    "signature:send",
    "Tu rol no permite enviar contratos a firma.",
    true
  );
  if (blocked) return blocked;

  const days = input.expiresInDays && input.expiresInDays >= 1 && input.expiresInDays <= 90
    ? input.expiresInDays
    : 14;
  const campaignId = session.context.campaignId ?? "";
  const ids = input.contractIds?.filter(Boolean) ?? [];
  const contracts = await prisma.contract.findMany({
    where: {
      status: { in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT] },
      deliverables: { some: { campaignId } },
      ...(ids.length > 0 ? { id: { in: ids.slice(0, SIGNATURE_FILTER_BATCH) } } : {}),
    },
    take: SIGNATURE_FILTER_BATCH,
    select: { id: true },
  });

  if (contracts.length === 0) {
    return { ok: false as const, error: "No hay contratos pendientes de firma en esta campaña." };
  }

  const report = await queueUnsignedContracts({
    contractIds: contracts.map((contract) => contract.id),
    expiresInDays: days,
    createdBy: aiActorLabel(session.user.email),
  });

  await recordAudit({
    entityType: "Contract",
    entityId: campaignId,
    action: "SIGNATURE_BATCH",
    actor: aiUser(session.user),
    metadata: { queued: report.queued, skipped: report.skipped, campaignId },
  });

  return { ok: true as const, queued: report.queued, skipped: report.skipped };
}

export async function runPreparePayoutBatch(
  session: AgentSession,
  input: ScopedInput & { deliverableIds?: string[] },
  options: ToolRunOptions
) {
  const blocked = await beginWrite(
    session,
    "preparePayoutBatch",
    input,
    options,
    "finance:manage",
    "Tu rol no permite preparar lotes de pago.",
    true
  );
  if (blocked) return blocked;

  const campaignId = session.context.campaignId ?? "";
  const queues = await loadFinanceQueues({ campana: campaignId });
  const lote = buildZexelLote(
    queues.payoutGroups,
    input.deliverableIds?.length ? input.deliverableIds : undefined
  );
  const total = payoutTotalsLabel(lote.ready);
  const file = await prisma.agentPayoutFile.create({
    data: {
      userId: session.user.id,
      campaignId,
      ready: lote.ready.length,
      missing: lote.missingEmail.length,
      totalLabel: total,
      csv: lote.csv,
    },
  });

  await recordAudit({
    entityType: "Deliverable",
    entityId: lote.itemIds.slice(0, 8).join(",") || "payout",
    action: "PAYOUT_PREPARED",
    actor: aiUser(session.user),
    metadata: {
      ready: lote.ready.length,
      missingEmail: lote.missingEmail.length,
      items: lote.itemIds.length,
      fileId: file.id,
    },
  });

  return {
    ok: true as const,
    ready: lote.ready.length,
    missingEmail: lote.missingEmail.length,
    items: lote.itemIds.length,
    total,
    downloadPath: `/api/agent/payouts/${file.id}`,
    markedPaid: false,
  };
}

export async function readAgentPayout(id: string, user: AppUser) {
  if (!can(user.role, "finance:manage")) {
    return Response.json({ error: "Tu rol no permite preparar lotes de pago." }, { status: 403 });
  }
  const file = await prisma.agentPayoutFile.findUnique({ where: { id } });
  if (!file || file.userId !== user.id) {
    return Response.json({ error: "Ese lote no existe." }, { status: 404 });
  }
  return new Response(file.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lote-${file.id}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function runDraftClientMessage(
  session: AgentSession,
  input: ScopedInput & { body: string },
  options: ToolRunOptions
) {
  const blocked = await beginWrite(
    session,
    "draftClientMessage",
    input,
    options,
    "campaigns:manage",
    "Tu rol no permite dejar notas en la campaña.",
    true
  );
  if (blocked) return blocked;
  const bound = { ok: true as const, id: input.campaignId ?? "" };
  const body = input.body.trim().slice(0, 4000);
  if (!body) return { ok: false as const, error: "El borrador está vacío." };

  const campaign = await prisma.campaign.findUnique({
    where: { id: bound.id },
    select: { id: true },
  });
  if (!campaign) return { ok: false as const, error: "Esa campaña no existe." };

  const message = await prisma.campaignMessage.create({
    data: {
      campaignId: campaign.id,
      authorKind: "AGENCY",
      authorLabel: aiActorLabel(session.user.email),
      body,
      visibility: "INTERNAL",
    },
  });

  await recordAudit({
    entityType: "CampaignMessage",
    entityId: message.id,
    action: "DRAFT_INTERNAL",
    actor: aiUser(session.user),
    metadata: { campaignId: campaign.id, visibility: "INTERNAL" },
  });

  return { ok: true as const, messageId: message.id, visibility: "INTERNAL" as const };
}

export async function previewSignatureWarning(contractIds: string[]) {
  if (contractIds.length === 0) return null;
  const rows = await prisma.contract.findMany({
    where: { id: { in: contractIds.slice(0, 20) } },
    select: { creator: { select: { handle: true, contactEmail: true } } },
  });
  const missing = rows
    .filter((row) => !row.creator.contactEmail?.trim())
    .map((row) => `@${row.creator.handle}`);
  if (missing.length === 0) return null;
  return `No tiene email de contacto: no se podrá enviar a firma (${missing.join(", ")}).`;
}

export async function previewPriceWarning(input: {
  talentId?: string;
  saleUsd?: string;
  cost?: string;
  currency?: string;
  deliverableCount?: string;
}) {
  if (!input.talentId) return null;
  const existing = await prisma.campaignTalent.findUnique({ where: { id: input.talentId } });
  if (!existing) return null;
  const saleRaw = input.saleUsd?.trim() || "";
  const costRaw = input.cost?.trim() || "";
  const currency = (
    costRaw ? input.currency?.trim() || existing.costCurrency || "EUR" : existing.costCurrency || "USD"
  ).toUpperCase();
  const sale = saleRaw
    ? parseAgentAmount(saleRaw, "USD")
    : existing.salePriceCentsPerContent;
  const cost = costRaw ? parseAgentAmount(costRaw, currency) : existing.costMinorPerContent;
  if (sale == null || cost == null) return null;
  if (currency === "USD") {
    return cost > sale ? "El margen sale negativo." : null;
  }
  if (fromMinorUnits(cost, currency) > fromMinorUnits(sale, "USD")) {
    return `El coste en ${currency} supera la venta en USD.`;
  }
  return null;
}

export async function previewPublishWarning(input: {
  deliverableId: string;
  contentDate: string;
}) {
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: input.deliverableId },
    select: { campaign: { select: { startsAt: true, endsAt: true } } },
  });
  const campaign = deliverable?.campaign;
  if (!campaign?.startsAt && !campaign?.endsAt) return null;
  const date = new Date(`${input.contentDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (campaign.startsAt && date < campaign.startsAt) {
    return "La fecha queda fuera de la vigencia de la campaña.";
  }
  if (campaign.endsAt && date > campaign.endsAt) {
    return "La fecha queda fuera de la vigencia de la campaña.";
  }
  return null;
}
