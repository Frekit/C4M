import { tool, type ToolApprovalStatus } from "ai";
import { z } from "zod";

import { can, type Permission } from "@/lib/auth/permissions";

import {
  previewPriceWarning,
  previewPublishWarning,
  previewSignatureWarning,
  runAddToDesk,
  runCreateDraftContract,
  runDraftClientMessage,
  runGetCampaignBriefing,
  runGetContract,
  runListPendingActions,
  runMarkPublished,
  runPreparePayoutBatch,
  runQueueSignatures,
  runSearchRoster,
  runSetLinePrice,
  runSetTalentStatus,
  type AgentSession,
} from "./commands";

function allow(userCan: boolean, message: string): ToolApprovalStatus {
  if (!userCan) return { type: "denied", reason: message };
  return "user-approval";
}

function allowWithReason(
  userCan: boolean,
  message: string,
  reason: string | null
): ToolApprovalStatus {
  if (!userCan) return { type: "denied", reason: message };
  if (reason) return { type: "user-approval", reason };
  return "user-approval";
}

function roleCan(session: AgentSession, permission: Permission) {
  return can(session.user.role, permission);
}

export function createC4mToolset(session: AgentSession) {
  const tools = {
    getCampaignBriefing: tool({
      description:
        "Lee el brief y la planilla de una campaña: perfiles en la mesa, precios, publicados y presupuesto. No escribe nada.",
      inputSchema: z.object({
        campaignId: z.string().optional().describe("Id de la campaña. Si estás en una, se usa esa."),
      }),
      execute: async (input) => runGetCampaignBriefing(session, input),
    }),
    searchRoster: tool({
      description:
        "Busca perfiles que ya existen en el roster por handle o nombre. No inventa handles ni crea perfiles.",
      inputSchema: z.object({
        query: z.string().min(1).max(80),
      }),
      execute: async (input) => runSearchRoster(session, input),
    }),
    listPendingActions: tool({
      description: "Lista lo que pide una decisión en el centro de acciones. Solo lectura.",
      inputSchema: z.object({}),
      execute: async () => runListPendingActions(session),
    }),
    getContract: tool({
      description:
        "Lee un contrato: código, estado, importes, contenidos y si hay email de contacto. No devuelve datos bancarios.",
      inputSchema: z.object({
        contractId: z.string().optional(),
        code: z.string().optional().describe("Código visible, por ejemplo CTR-2026-001."),
      }),
      execute: async (input) => runGetContract(session, input),
    }),
    addToDesk: tool({
      description:
        "Mete en la mesa de la campaña un perfil que ya existe en el roster. No crea perfiles nuevos.",
      inputSchema: z.object({
        campaignId: z.string().optional(),
        handle: z.string().describe("Handle de Instagram, con o sin @. Tiene que existir."),
      }),
      execute: async (input) => runAddToDesk(session, input),
    }),
    setLinePrice: tool({
      description:
        "Guarda venta, coste y piezas de una línea que todavía no se ha enviado ni activado. Usa solo importes que haya dicho la persona.",
      inputSchema: z.object({
        talentId: z.string(),
        saleUsd: z.string().optional().describe("Venta por contenido en USD, como la dijo la persona."),
        cost: z.string().optional().describe("Coste en la moneda del creator."),
        currency: z.string().optional(),
        deliverableCount: z.string().optional(),
        contentPlatform: z.string().optional(),
        contentFormat: z.string().optional(),
      }),
      execute: async (input) => runSetLinePrice(session, input),
    }),
    setTalentStatus: tool({
      description:
        "Aprueba o rechaza una línea que el dominio ya tiene como propuesta. No activa ni crea el contrato.",
      inputSchema: z.object({
        talentId: z.string(),
        status: z.enum(["APPROVED", "REJECTED"]),
      }),
      execute: async (input) => runSetTalentStatus(session, input),
    }),
    createDraftContract: tool({
      description:
        "Crea el contrato en borrador al activar una línea lista, con las reglas de la planilla. No lo envía a firma.",
      inputSchema: z.object({
        talentId: z.string(),
      }),
      execute: async (input) => runCreateDraftContract(session, input),
    }),
    markPublished: tool({
      description:
        "Marca un contenido como publicado en redes. Exige fecha y enlace. No lo sube a la plataforma del cliente.",
      inputSchema: z.object({
        deliverableId: z.string(),
        contentDate: z.string().describe("Fecha YYYY-MM-DD."),
        postUrl: z.string().describe("Enlace público del contenido."),
      }),
      execute: async (input) => runMarkPublished(session, input),
    }),
    queueSignatures: tool({
      description:
        "Encola el envío a firma de contratos en borrador o ya enviados. No firma en nombre de nadie.",
      inputSchema: z.object({
        contractIds: z.array(z.string()).max(80).optional(),
        campaignId: z.string().optional(),
        expiresInDays: z.number().int().min(1).max(90).optional(),
      }),
      execute: async (input) => runQueueSignatures(session, input),
    }),
    preparePayoutBatch: tool({
      description:
        "Arma el CSV del lote de Zexel con lo que ya se puede pagar. No marca los contenidos como pagados.",
      inputSchema: z.object({
        deliverableIds: z.array(z.string()).max(80).optional(),
        campaignId: z.string().optional(),
      }),
      execute: async (input) => runPreparePayoutBatch(session, input),
    }),
    draftClientMessage: tool({
      description:
        "Guarda un borrador de mensaje para el equipo, siempre INTERNAL. No lo hace visible al cliente ni lo envía.",
      inputSchema: z.object({
        campaignId: z.string().optional(),
        body: z.string().min(1).max(4000),
      }),
      execute: async (input) => runDraftClientMessage(session, input),
    }),
  };

  const toolApproval = {
    getCampaignBriefing: "not-applicable" as const,
    searchRoster: "not-applicable" as const,
    listPendingActions: "not-applicable" as const,
    getContract: "not-applicable" as const,
    addToDesk: allow(
      roleCan(session, "campaigns:manage"),
      "Tu rol no permite meter perfiles en la mesa."
    ),
    setLinePrice: async (input: { saleUsd?: string; cost?: string; currency?: string }) => {
      const warning = await previewPriceWarning(input);
      return allowWithReason(
        roleCan(session, "campaigns:manage"),
        "Tu rol no permite cambiar precios de la planilla.",
        warning
      );
    },
    setTalentStatus: allow(
      roleCan(session, "campaigns:manage"),
      "Tu rol no permite cambiar el estado de un perfil."
    ),
    createDraftContract: allow(
      roleCan(session, "contracts:write"),
      "Tu rol no permite crear contratos."
    ),
    markPublished: async (input: { deliverableId: string; contentDate: string }) => {
      const warning = await previewPublishWarning(input);
      return allowWithReason(
        roleCan(session, "deliverables:publish"),
        "Tu rol no permite marcar contenidos como publicados.",
        warning
      );
    },
    queueSignatures: async (input: { contractIds?: string[] }) => {
      const warning = input.contractIds?.length
        ? await previewSignatureWarning(input.contractIds)
        : null;
      return allowWithReason(
        roleCan(session, "signature:send"),
        "Tu rol no permite enviar contratos a firma.",
        warning
      );
    },
    preparePayoutBatch: allow(
      roleCan(session, "finance:manage"),
      "Tu rol no permite preparar lotes de pago."
    ),
    draftClientMessage: allow(
      roleCan(session, "campaigns:manage"),
      "Tu rol no permite dejar notas en la campaña."
    ),
  };

  return { tools, toolApproval };
}