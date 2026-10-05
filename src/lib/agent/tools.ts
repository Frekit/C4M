import { tool } from "ai";
import { z } from "zod";

import { can, type Permission } from "@/lib/auth/permissions";

import type { AgentSession, ScopedInput, ToolRunOptions } from "./commands";
import {
  previewPriceWarning,
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
} from "./commands";
import { isStrictIsoDate } from "./dates";
import { describeWriteEffect } from "./effect";

const scope = {
  campaignId: z.string().optional(),
  contractId: z.string().optional(),
  creatorId: z.string().optional(),
  actorUserId: z.string().optional(),
};

function roleCan(session: AgentSession, permission: Permission) {
  return can(session.user.role, permission);
}

function stamp<T extends ScopedInput>(session: AgentSession, input: T): T {
  return {
    ...input,
    campaignId: session.context.campaignId ?? "",
    contractId: session.context.contractId ?? "",
    creatorId: session.context.creatorId ?? "",
    actorUserId: session.user.id,
  };
}

async function safeTool<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    console.error("agent tool", error);
    return { ok: false as const, error: "No he podido hacer ese cambio." };
  }
}

function asRecord(input: object): Record<string, unknown> {
  return input as Record<string, unknown>;
}

export function createC4mToolset(session: AgentSession) {
  async function approve(
    name: string,
    permission: Permission,
    denial: string,
    input: object,
    warning?: string | null
  ) {
    if (!roleCan(session, permission)) return { type: "denied" as const, reason: denial };
    const effect = await describeWriteEffect(session.context, name, asRecord(input));
    const reason = warning ? `${effect}\nAviso: ${warning}` : effect;
    return { type: "user-approval" as const, reason };
  }

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
        ...scope,
        handle: z.string().describe("Handle de Instagram, con o sin @. Tiene que existir."),
      }),
      execute: async (input, options) =>
        safeTool(() => runAddToDesk(session, input, options as ToolRunOptions)),
    }),
    setLinePrice: tool({
      description:
        "Guarda venta, coste y piezas de una línea que todavía no se ha enviado ni activado. Los campos que no envíes se conservan. Usa solo importes que haya dicho la persona, como 1500 o 1500,50.",
      inputSchema: z.object({
        ...scope,
        talentId: z.string(),
        saleUsd: z.string().optional().describe("Venta por contenido en USD, como la dijo la persona."),
        cost: z.string().optional().describe("Coste en la moneda del creator."),
        currency: z.string().optional(),
        deliverableCount: z.string().optional(),
        contentPlatform: z.string().optional(),
        contentFormat: z.string().optional(),
      }),
      execute: async (input, options) =>
        safeTool(() => runSetLinePrice(session, input, options as ToolRunOptions)),
    }),
    setTalentStatus: tool({
      description:
        "Aprueba o rechaza una línea que el dominio ya tiene como propuesta. No activa ni crea el contrato.",
      inputSchema: z.object({
        ...scope,
        talentId: z.string(),
        status: z.enum(["APPROVED", "REJECTED"]),
      }),
      execute: async (input, options) =>
        safeTool(() => runSetTalentStatus(session, input, options as ToolRunOptions)),
    }),
    createDraftContract: tool({
      description:
        "Crea el contrato en borrador al activar una línea lista, con las reglas de la planilla. No lo envía a firma.",
      inputSchema: z.object({
        ...scope,
        talentId: z.string(),
      }),
      execute: async (input, options) =>
        safeTool(() => runCreateDraftContract(session, input, options as ToolRunOptions)),
    }),
    markPublished: tool({
      description:
        "Marca un contenido como publicado en redes. Exige fecha ISO real y enlace. No lo sube a la plataforma del cliente.",
      inputSchema: z.object({
        ...scope,
        deliverableId: z.string(),
        contentDate: z.string().refine(isStrictIsoDate, "Fecha no válida."),
        postUrl: z.url(),
      }),
      execute: async (input, options) =>
        safeTool(() => runMarkPublished(session, input, options as ToolRunOptions)),
    }),
    queueSignatures: tool({
      description:
        "Encola el envío a firma de contratos en borrador o ya enviados de la campaña abierta. No firma en nombre de nadie y no manda el correo en el acto.",
      inputSchema: z.object({
        ...scope,
        contractIds: z.array(z.string()).max(80).optional(),
        expiresInDays: z.number().int().min(1).max(90).optional(),
      }),
      execute: async (input, options) =>
        safeTool(() => runQueueSignatures(session, input, options as ToolRunOptions)),
    }),
    preparePayoutBatch: tool({
      description:
        "Prepara el lote de Zexel de la campaña abierta y devuelve el recuento, el total y un enlace de descarga. No marca los contenidos como pagados ni pega el CSV.",
      inputSchema: z.object({
        ...scope,
        deliverableIds: z.array(z.string()).max(80).optional(),
      }),
      execute: async (input, options) =>
        safeTool(() => runPreparePayoutBatch(session, input, options as ToolRunOptions)),
    }),
    draftClientMessage: tool({
      description:
        "Guarda un borrador de mensaje para el equipo, siempre INTERNAL. No lo hace visible al cliente ni lo envía.",
      inputSchema: z.object({
        ...scope,
        body: z.string().min(1).max(4000),
      }),
      execute: async (input, options) =>
        safeTool(() => runDraftClientMessage(session, input, options as ToolRunOptions)),
    }),
  };

  const toolApproval = {
    getCampaignBriefing: "not-applicable" as const,
    searchRoster: "not-applicable" as const,
    listPendingActions: "not-applicable" as const,
    getContract: "not-applicable" as const,
    addToDesk: (input: { handle: string }) =>
      approve("addToDesk", "campaigns:manage", "Tu rol no permite meter perfiles en la mesa.", input),
    setLinePrice: async (input: {
      talentId?: string;
      saleUsd?: string;
      cost?: string;
      currency?: string;
    }) => {
      const warning = await previewPriceWarning(input);
      return approve(
        "setLinePrice",
        "campaigns:manage",
        "Tu rol no permite cambiar precios de la planilla.",
        input,
        warning
      );
    },
    setTalentStatus: (input: object) =>
      approve(
        "setTalentStatus",
        "campaigns:manage",
        "Tu rol no permite cambiar el estado de un perfil.",
        input
      ),
    createDraftContract: (input: object) =>
      approve(
        "createDraftContract",
        "contracts:write",
        "Tu rol no permite crear contratos.",
        input
      ),
    markPublished: (input: object) =>
      approve(
        "markPublished",
        "deliverables:publish",
        "Tu rol no permite marcar contenidos como publicados.",
        input
      ),
    queueSignatures: async (input: { contractIds?: string[] }) => {
      const warning = input.contractIds?.length
        ? await previewSignatureWarning(input.contractIds)
        : null;
      return approve(
        "queueSignatures",
        "signature:send",
        "Tu rol no permite enviar contratos a firma.",
        input,
        warning
      );
    },
    preparePayoutBatch: (input: object) =>
      approve(
        "preparePayoutBatch",
        "finance:manage",
        "Tu rol no permite preparar lotes de pago.",
        input
      ),
    draftClientMessage: (input: object) =>
      approve(
        "draftClientMessage",
        "campaigns:manage",
        "Tu rol no permite dejar notas en la campaña.",
        input
      ),
  };

  const bind = <T extends ScopedInput>(input: T): T => stamp(session, input);

  const refineToolInput = {
    addToDesk: bind,
    setLinePrice: bind,
    setTalentStatus: bind,
    createDraftContract: bind,
    markPublished: bind,
    queueSignatures: bind,
    preparePayoutBatch: bind,
    draftClientMessage: bind,
  };

  return { tools, toolApproval, refineToolInput };
}
