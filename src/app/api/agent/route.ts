import { convertToModelMessages, type UIMessage } from "ai";
import { revalidatePath } from "next/cache";

import { createC4mAgent } from "@/lib/agent/agent";
import {
  AGENT_MAX_BODY_BYTES,
  AGENT_MAX_MESSAGES,
  AGENT_MAX_TEXT_CHARS,
  aiSetup,
  isLocalMockModel,
} from "@/lib/agent/config";
import { createLocalFixtureModel } from "@/lib/agent/local-fixture";
import { persistAgentTurn } from "@/lib/agent/messages";
import { parseRouteContext, type AgentRouteContext } from "@/lib/agent/route-context";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const maxDuration = 60;

function textLength(message: { parts?: Array<{ type?: string; text?: string }> }) {
  return (message.parts ?? []).reduce(
    (sum, part) => sum + (part.type === "text" ? part.text?.length ?? 0 : 0),
    0
  );
}

function lastUserText(messages: UIMessage[]) {
  const last = [...messages].reverse().find((message) => message.role === "user");
  if (!last) return "";
  return last.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

async function resolveContext(raw: unknown): Promise<
  | { ok: true; context: AgentRouteContext }
  | { ok: false; error: string }
> {
  const context = parseRouteContext(raw);
  if (context.campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: context.campaignId },
      select: { id: true },
    });
    if (!campaign) return { ok: false, error: "Esa campaña no existe." };
  }
  if (context.contractId) {
    const contract = await prisma.contract.findUnique({
      where: { id: context.contractId },
      select: { id: true },
    });
    if (!contract) return { ok: false, error: "Ese contrato no existe." };
  }
  if (context.creatorId) {
    const creator = await prisma.creator.findUnique({
      where: { id: context.creatorId },
      select: { id: true },
    });
    if (!creator) return { ok: false, error: "Ese perfil no existe." };
  }
  return { ok: true, context };
}

export async function POST(request: Request) {
  // requireUser redirige a las pantallas. Aquí la misma sesión responde 401.
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }
  if (!user) {
    return Response.json({ error: "Sin sesión" }, { status: 401 });
  }

  if (aiSetup() !== "ready") {
    return Response.json({ error: "IA no configurada" }, { status: 503 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > AGENT_MAX_BODY_BYTES) {
    return Response.json({ error: "La conversación es demasiado grande." }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "El cuerpo no es JSON." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return Response.json({ error: "El cuerpo no es válido." }, { status: 400 });
  }

  const record = payload as { messages?: unknown; context?: unknown };
  if (!Array.isArray(record.messages) || record.messages.length === 0) {
    return Response.json({ error: "Faltan los mensajes." }, { status: 400 });
  }
  if (record.messages.length > AGENT_MAX_MESSAGES) {
    return Response.json({ error: "Hay demasiados mensajes en esta conversación." }, { status: 413 });
  }
  if (record.messages.some((message) => textLength(message as UIMessage) > AGENT_MAX_TEXT_CHARS)) {
    return Response.json({ error: "Un mensaje pasa del tamaño permitido." }, { status: 413 });
  }

  const resolved = await resolveContext(record.context);
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: 400 });
  }

  const messages = record.messages as UIMessage[];
  const agent = createC4mAgent(
    { user, context: resolved.context },
    isLocalMockModel() ? createLocalFixtureModel() : undefined
  );

  try {
    const modelMessages = await convertToModelMessages(messages, {
      tools: agent.tools,
    });
    const result = await agent.stream({
      messages: modelMessages,
      abortSignal: request.signal,
      onEnd: async (event) => {
        const fromParts = event.content
          .filter((part) => part.type === "text" && "text" in part)
          .map((part) => part.text)
          .join("\n")
          .trim();
        const answer = event.text.trim() || fromParts;
        if (!resolved.context.campaignId) return;
        const freshQuestion = messages.at(-1)?.role === "user";
        await persistAgentTurn({
          campaignId: resolved.context.campaignId,
          user,
          question: freshQuestion ? lastUserText(messages) : "",
          answer,
        });
        revalidatePath(`/campanas/${resolved.context.campaignId}`);
        revalidatePath(`/campanas/${resolved.context.campaignId}/planilla`);
      },
    });
    return result.toUIMessageStreamResponse();
  } catch (error) {
    const message = error instanceof Error ? error.message : "No he podido responder.";
    return Response.json({ error: message }, { status: 400 });
  }
}
