import { prisma } from "@/lib/db";
import { CONTRACT_STATUS, SIGNATURE_FILTER_BATCH } from "@/lib/domain/enums";
import { loadFinanceQueues } from "@/lib/domain/finance";
import { extractInstagramHandle } from "@/lib/domain/instagram-handle";
import { buildZexelLote } from "@/lib/domain/zexel-batch";
import { formatMoney } from "@/lib/money";
import { resolveMergedQuote } from "@/lib/domain/talent-commands";

function shown(value: string) {
  const authoredWarning = value.startsWith("Aviso:");
  const body = authoredWarning ? value.slice("Aviso:".length) : value;
  const cleaned = body
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (authoredWarning) return cleaned ? `Aviso: ${cleaned}` : "";
  if (cleaned.startsWith("Aviso:")) return `«${cleaned}»`;
  return cleaned;
}

function lines(...parts: Array<string | null | undefined | false>) {
  return parts
    .filter((part): part is string => Boolean(part))
    .map(shown)
    .filter(Boolean)
    .join("\n");
}

function moneyLine(
  sale: number | null,
  cost: number | null,
  currency: string | null,
  pieces: number | null
) {
  const saleLabel = sale != null ? formatMoney(sale, "USD") : "sin venta";
  const costLabel =
    cost != null && currency ? formatMoney(cost, currency) : "sin coste";
  const piecesLabel = pieces != null ? `${pieces} piezas` : "sin piezas";
  return `Se guardará: venta ${saleLabel} · coste ${costLabel} · ${piecesLabel}`;
}

async function talentLine(talentId: string) {
  return prisma.campaignTalent.findUnique({
    where: { id: talentId },
    include: {
      creator: { select: { handle: true, displayName: true } },
      campaign: { select: { id: true, name: true } },
    },
  });
}

export async function describeWriteEffect(
  context: { campaignId?: string },
  name: string,
  input: Record<string, unknown>
) {
  if (name === "addToDesk") return describeAdd(context, input);
  if (name === "setLinePrice") return describePrice(input);
  if (name === "setTalentStatus") return describeStatus(input);
  if (name === "createDraftContract") return describeContract(input);
  if (name === "markPublished") return describePublish(context, input);
  if (name === "queueSignatures") return describeSignatures(context, input);
  if (name === "preparePayoutBatch") return describePayout(context, input);
  if (name === "draftClientMessage") return describeDraft(input);
  return "Cambio";
}

async function describeAdd(
  context: { campaignId?: string },
  input: Record<string, unknown>
) {
  const handle = extractInstagramHandle(String(input.handle ?? "")) ?? "";
  const campaign = context.campaignId
    ? await prisma.campaign.findUnique({
        where: { id: context.campaignId },
        select: { name: true },
      })
    : null;
  const creator = handle
    ? await prisma.creator.findFirst({
        where: { handle },
        select: { handle: true, displayName: true },
      })
    : null;
  return lines(
    creator ? `Meter en la mesa · @${creator.handle}` : `Meter en la mesa · @${handle || "?"}`,
    creator?.displayName || null,
    campaign ? `Campaña ${campaign.name}` : "Abre la campaña antes de hacer este cambio.",
    creator ? null : "No está en el roster. No se creará un perfil."
  );
}

async function describePrice(input: Record<string, unknown>) {
  const talentId = String(input.talentId ?? "");
  const line = talentId ? await talentLine(talentId) : null;
  if (!line) return "Cambiar precio\nEsa línea no existe.";
  const resolved = resolveMergedQuote(line, {
    saleUsd: typeof input.saleUsd === "string" ? input.saleUsd : undefined,
    cost: typeof input.cost === "string" ? input.cost : undefined,
    currency: typeof input.currency === "string" ? input.currency : undefined,
    deliverableCount:
      typeof input.deliverableCount === "string" ? input.deliverableCount : undefined,
    contentPlatform:
      typeof input.contentPlatform === "string" ? input.contentPlatform : undefined,
    contentFormat: typeof input.contentFormat === "string" ? input.contentFormat : undefined,
  });
  if (!resolved.ok) {
    return lines(
      `Cambiar precio · @${line.creator.handle}`,
      line.creator.displayName,
      resolved.error,
      "No se guardará ese texto."
    );
  }
  const quote = resolved.quote;
  return lines(
    `Cambiar precio · @${line.creator.handle}`,
    line.creator.displayName,
    `Campaña ${line.campaign.name}`,
    moneyLine(
      quote.salePriceCentsPerContent,
      quote.costMinorPerContent,
      quote.costCurrency,
      quote.deliverableCount
    )
  );
}

async function describeStatus(input: Record<string, unknown>) {
  const line = await talentLine(String(input.talentId ?? ""));
  if (!line) return "Cambiar estado\nEsa línea no existe.";
  const next = input.status === "REJECTED" ? "Rechazado" : "Aprobado";
  return lines(
    `Cambiar estado · @${line.creator.handle}`,
    line.creator.displayName,
    `Campaña ${line.campaign.name}`,
    `Propuesto → ${next}`
  );
}

async function describeContract(input: Record<string, unknown>) {
  const line = await talentLine(String(input.talentId ?? ""));
  if (!line) return "Crear contrato en borrador\nEsa línea no existe.";
  return lines(
    `Crear contrato · @${line.creator.handle}`,
    line.creator.displayName,
    `Campaña ${line.campaign.name}`,
    moneyLine(
      line.salePriceCentsPerContent,
      line.costMinorPerContent,
      line.costCurrency,
      line.deliverableCount
    ),
    "Borrador. No se envía a firma."
  );
}

async function describePublish(
  context: { campaignId?: string },
  input: Record<string, unknown>
) {
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: String(input.deliverableId ?? "") },
    select: {
      campaignId: true,
      postUrl: true,
      contract: { select: { creator: { select: { handle: true, displayName: true } } } },
      campaign: { select: { name: true } },
    },
  });
  const url = typeof input.postUrl === "string" ? input.postUrl : "";
  const date = typeof input.contentDate === "string" ? input.contentDate : "";
  if (!deliverable) return lines("Marcar publicado", url, "Ese contenido no existe.");
  const warning = await publishWindowWarning(String(input.deliverableId ?? ""), date);
  const offCampaign =
    Boolean(context.campaignId) && deliverable.campaignId !== context.campaignId;
  return lines(
    `Marcar publicado · @${deliverable.contract.creator.handle}`,
    deliverable.contract.creator.displayName,
    deliverable.campaign?.name ? `Campaña ${deliverable.campaign.name}` : null,
    url ? `Enlace ${url}` : null,
    date ? `Fecha ${date}` : null,
    offCampaign ? "Ese contenido no es de esta campaña." : null,
    warning ? `Aviso: ${warning}` : null
  );
}

async function publishWindowWarning(deliverableId: string, contentDate: string) {
  const deliverable = await prisma.deliverable.findUnique({
    where: { id: deliverableId },
    select: { campaign: { select: { startsAt: true, endsAt: true } } },
  });
  const campaign = deliverable?.campaign;
  if (!campaign?.startsAt && !campaign?.endsAt) return null;
  const date = new Date(`${contentDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (
    (campaign.startsAt && date < campaign.startsAt) ||
    (campaign.endsAt && date > campaign.endsAt)
  ) {
    return "La fecha queda fuera de la vigencia de la campaña.";
  }
  return null;
}

async function describeSignatures(
  context: { campaignId?: string },
  input: Record<string, unknown>
) {
  const campaignId = context.campaignId;
  if (!campaignId) return "Enviar a firma\nAbre la campaña antes de hacer este cambio.";
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true },
  });
  const ids = Array.isArray(input.contractIds)
    ? input.contractIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const contracts = await prisma.contract.findMany({
    where: {
      status: { in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT] },
      deliverables: { some: { campaignId } },
      ...(ids.length > 0 ? { id: { in: ids.slice(0, SIGNATURE_FILTER_BATCH) } } : {}),
    },
    take: SIGNATURE_FILTER_BATCH,
    select: {
      code: true,
      creator: { select: { handle: true, contactEmail: true } },
    },
    orderBy: { code: "asc" },
  });
  return lines(
    `Enviar a firma · ${campaign?.name ?? "esta campaña"}`,
    ...contracts.map(
      (contract) =>
        `${contract.code} · @${contract.creator.handle} · ${contract.creator.contactEmail?.trim() || "sin email"}`
    ),
    contracts.length === 0
      ? "No hay contratos en borrador o enviados en esta campaña."
      : `${contracts.length} envíos. Cada uno revoca el enlace vivo y deja el correo en cola.`
  );
}

async function describePayout(
  context: { campaignId?: string },
  input: Record<string, unknown>
) {
  if (!context.campaignId) {
    return "Preparar lote de pago\nAbre la campaña antes de hacer este cambio.";
  }
  const campaign = await prisma.campaign.findUnique({
    where: { id: context.campaignId },
    select: { name: true },
  });
  const queues = await loadFinanceQueues({ campana: context.campaignId });
  const selected = Array.isArray(input.deliverableIds)
    ? input.deliverableIds.filter((id): id is string => typeof id === "string")
    : undefined;
  const lote = buildZexelLote(queues.payoutGroups, selected);
  return lines(
    `Preparar lote de pago · ${campaign?.name ?? "esta campaña"}`,
    `${lote.ready.length} listos · ${totalsLabel(lote.ready)}`,
    `Sin email: ${lote.missingEmail.length}`,
    `${lote.itemIds.length} contenidos. No se marca nada como pagado.`
  );
}

function totalsLabel(rows: Array<{ currency: string; amountMinor: number }>) {
  const byCurrency = new Map<string, number>();
  for (const row of rows) {
    byCurrency.set(row.currency, (byCurrency.get(row.currency) ?? 0) + row.amountMinor);
  }
  if (byCurrency.size === 0) return "0";
  return [...byCurrency.entries()].map(([currency, minor]) => formatMoney(minor, currency)).join(" + ");
}

function describeDraft(input: Record<string, unknown>) {
  const body = typeof input.body === "string" ? input.body.trim().slice(0, 180) : "";
  return lines("Borrador interno", "Visibilidad INTERNAL. El cliente no lo ve.", body);
}

export function payoutTotalsLabel(rows: Array<{ currency: string; amountMinor: number }>) {
  return totalsLabel(rows);
}
