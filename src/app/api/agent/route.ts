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
import { consumeAgentRate } from "@/lib/agent/rate-limit";
import { parseRouteContext, type AgentRouteContext } from "@/lib/agent/route-context";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import type { AppUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db";

export const maxDuration = 60;

const GENERIC_ERROR = "No he podido responder.";

function messageChars(message: unknown) {
  if (!message || typeof message !== "object") return 0;
  const parts = (message as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) {
    const content = (message as { content?: unknown }).content;
    return typeof content === "string" ? content.length : 0;
  }
  return parts.reduce<number>((sum, part) => {
    if (!part || typeof part !== "object") return sum;
    const record = part as { type?: string; text?: string };
    if (record.type === "text" && typeof record.text === "string") return sum + record.text.length;
    return sum;
  }, 0);
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

async function readCappedBody(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > AGENT_MAX_BODY_BYTES) {
    return { ok: false as const, error: "La conversación es demasiado grande." };
  }
  if (!request.body) {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > AGENT_MAX_BODY_BYTES) {
      return { ok: false as const, error: "La conversación es demasiado grande." };
    }
    return { ok: true as const, text };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > AGENT_MAX_BODY_BYTES) {
      await reader.cancel();
      return { ok: false as const, error: "La conversación es demasiado grande." };
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true as const, text: new TextDecoder().decode(merged) };
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

export async function handleAgentPost(request: Request, user: AppUser) {
  if (aiSetup() !== "ready") {
    return Response.json({ error: "IA no configurada" }, { status: 503 });
  }

  const rate = consumeAgentRate(user.id);
  if (!rate.ok) {
    return Response.json(
      { error: `Demasiadas peticiones. El límite es ${rate.limit} por minuto.` },
      { status: 429 }
    );
  }

  const body = await readCappedBody(request);
  if (!body.ok) {
    return Response.json({ error: body.error }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body.text);
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
  const messages = (record.messages as UIMessage[]).slice(-AGENT_MAX_MESSAGES);
  if (messages.some((message) => messageChars(message) > AGENT_MAX_TEXT_CHARS)) {
    return Response.json({ error: "Un mensaje pasa del tamaño permitido." }, { status: 413 });
  }

  const resolved = await resolveContext(record.context);
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: 400 });
  }

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
        if (!can(user.role, "campaigns:manage")) return;
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
    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error("agent stream", error);
        return GENERIC_ERROR;
      },
    });
  } catch (error) {
    console.error("agent route", error);
    return Response.json({ error: GENERIC_ERROR }, { status: 400 });
  }
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
  return handleAgentPost(request, user);
}
