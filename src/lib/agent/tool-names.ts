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

const FIXED_TITLE: Record<string, string> = {
  addToDesk: "Meter en la mesa",
  setLinePrice: "Cambiar precio",
  setTalentStatus: "Cambiar estado",
  createDraftContract: "Crear contrato en borrador",
  markPublished: "Marcar publicado",
  queueSignatures: "Enviar a firma",
  preparePayoutBatch: "Preparar lote de pago",
  draftClientMessage: "Borrador interno",
};

/** Correo o dinero: no se aceptan con Y ni en bloque. */
export const SENSITIVE_WRITE_TOOLS = new Set<string>([
  "setLinePrice",
  "createDraftContract",
  "queueSignatures",
  "preparePayoutBatch",
  "markPublished",
]);

export function isSensitiveWrite(name: string) {
  return SENSITIVE_WRITE_TOOLS.has(name);
}

export function fixedWriteTitle(name: string) {
  return FIXED_TITLE[name] ?? "Cambio";
}

/** El texto de la tarjeta sale del servidor. El input del modelo no se pinta. */
export function approvalCardFromReason(name: string, reason: string | undefined) {
  const lines = (reason ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const warnings = lines
    .filter((line) => line.startsWith("Aviso:"))
    .map((line) => line.slice("Aviso:".length).trim())
    .filter(Boolean);
  const body = lines.filter((line) => !line.startsWith("Aviso:"));
  if (body.length === 0) {
    return {
      title: fixedWriteTitle(name),
      detail: "El servidor no ha descrito el cambio.",
      warning: warnings.join(" ") || undefined,
    };
  }
  return {
    title: body[0] ?? fixedWriteTitle(name),
    detail: body.slice(1).join(" · ") || "Cambio propuesto",
    warning: warnings.join(" ") || undefined,
  };
}
