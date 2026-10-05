export const WRITE_TOOL_NAMES = [
  "addToDesk",
  "setLinePrice",
  "setTalentStatus",
  "createDraftContract",
  "markPublished",
  "queueSignatures",
  "preparePayoutBatch",
  "draftClientMessage",
] as const;

export const READ_TOOL_NAMES = [
  "getCampaignBriefing",
  "searchRoster",
  "listPendingActions",
  "getContract",
] as const;

export type WriteToolName = (typeof WRITE_TOOL_NAMES)[number];
export type ReadToolName = (typeof READ_TOOL_NAMES)[number];

const WRITE = new Set<string>(WRITE_TOOL_NAMES);
const READ = new Set<string>(READ_TOOL_NAMES);

export function toolNameFromPart(type: string) {
  return type.startsWith("tool-") ? type.slice("tool-".length) : "";
}

export function isWriteTool(name: string) {
  return WRITE.has(name);
}

export function isReadTool(name: string) {
  return READ.has(name);
}

export function readToolLabel(name: string, output: unknown, pending: boolean) {
  const record = output && typeof output === "object" ? (output as Record<string, unknown>) : {};
  const campaign = typeof record.campaignName === "string" ? record.campaignName : "";
  if (pending) {
    if (name === "getCampaignBriefing") return "Leyendo la planilla…";
    if (name === "searchRoster") return "Buscando en el roster…";
    if (name === "listPendingActions") return "Mirando lo pendiente…";
    if (name === "getContract") return "Leyendo el contrato…";
    return "Consultando…";
  }
  if (name === "getCampaignBriefing") {
    const rows = Array.isArray(record.onDesk) ? record.onDesk.length : null;
    return campaign
      ? `Ha leído la planilla de ${campaign}${rows != null ? ` · ${rows} filas` : ""}`
      : "Ha leído la planilla";
  }
  if (name === "searchRoster") {
    const count = Array.isArray(record.items) ? record.items.length : 0;
    return `Ha buscado en el roster · ${count} perfiles`;
  }
  if (name === "listPendingActions") return "Ha leído el centro de acciones";
  if (name === "getContract") {
    const code = typeof record.code === "string" ? record.code : "";
    return code ? `Ha leído el contrato ${code}` : "Ha leído el contrato";
  }
  return "Consulta hecha";
}

export function writeToolTitle(name: string, input: unknown) {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const handle = typeof record.handle === "string" ? record.handle.replace(/^@/, "") : "";
  if (name === "addToDesk") return handle ? `Meter en la mesa · @${handle}` : "Meter en la mesa";
  if (name === "setLinePrice") return "Cambiar precio";
  if (name === "setTalentStatus") {
    return handle ? `Cambiar estado · @${handle}` : "Cambiar estado";
  }
  if (name === "createDraftContract") {
    return handle ? `Crear contrato · @${handle}` : "Crear contrato en borrador";
  }
  if (name === "markPublished") return "Marcar publicado";
  if (name === "queueSignatures") return "Enviar a firma";
  if (name === "preparePayoutBatch") return "Preparar lote de pago";
  if (name === "draftClientMessage") return "Borrador interno";
  return "Cambio";
}

export function writeToolDetail(name: string, input: unknown) {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  if (name === "setTalentStatus" && typeof record.status === "string") {
    return record.status === "APPROVED" ? "Propuesto → Aprobado" : "Propuesto → Rechazado";
  }
  if (name === "setLinePrice") {
    const sale = typeof record.saleUsd === "string" ? record.saleUsd : "";
    const cost = typeof record.cost === "string" ? record.cost : "";
    const currency = typeof record.currency === "string" ? record.currency : "";
    return [sale && `venta ${sale} USD`, cost && `coste ${cost} ${currency}`]
      .filter(Boolean)
      .join(" · ");
  }
  if (name === "createDraftContract") return "Borrador, sin enviar a firma";
  if (name === "markPublished") {
    return typeof record.contentDate === "string"
      ? `Publicar el ${record.contentDate}`
      : "Publicar en redes";
  }
  if (name === "queueSignatures") return "Encola la firma. No firma sola.";
  if (name === "preparePayoutBatch") return "Arma el CSV. No marca el lote como pagado.";
  if (name === "draftClientMessage" && typeof record.body === "string") {
    return record.body.slice(0, 140);
  }
  if (name === "addToDesk" && typeof record.handle === "string") {
    return `@${record.handle.replace(/^@/, "")}`;
  }
  return "Cambio propuesto";
}
