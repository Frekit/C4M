import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";

import type { LanguageModelV4GenerateResult } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import type { ModelMessage } from "ai";

import { aiSetup, isLocalMockModel } from "@/lib/agent/config";
import type { AppUser } from "@/lib/auth/types";
import type { Role } from "@/lib/domain/enums";

const root = path.resolve(import.meta.dirname, "..");
const dir = mkdtempSync(path.join(tmpdir(), "c4m-agent-"));
const dbFile = path.join(dir, "agent.db");

process.env.DATABASE_URL = `file:${dbFile}`;
process.env.AUTH_MODE = "local";
process.env.APP_ENV = "local";
process.env.TOOL_APPROVAL_SECRET = "test-approval-secret";
process.env.C4M_AI_MODEL = "test/model";
process.env.AI_GATEWAY_API_KEY = "";
process.env.RESEND_API_KEY = "";

execFileSync(
  path.join(root, "node_modules", ".bin", "prisma"),
  ["db", "push", "--skip-generate", "--accept-data-loss"],
  { cwd: root, env: process.env, stdio: "pipe" }
);

const usage: LanguageModelV4GenerateResult["usage"] = {
  inputTokens: { total: 4, noCache: 4, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 4, text: 4, reasoning: 0 },
};

function toolResult(
  toolCallId: string,
  toolName: string,
  input: Record<string, unknown>
): LanguageModelV4GenerateResult {
  return {
    content: [
      {
        type: "tool-call",
        toolCallId,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: "tool-calls", raw: undefined },
    usage,
    warnings: [],
  };
}

function textResult(value: string): LanguageModelV4GenerateResult {
  return {
    content: [{ type: "text", text: value }],
    finishReason: { unified: "stop", raw: undefined },
    usage,
    warnings: [],
  };
}

function modelOf(results: LanguageModelV4GenerateResult[]) {
  return new MockLanguageModelV4({ doGenerate: results });
}

type ApprovalPart = {
  type: "tool-approval-request";
  approvalId: string;
  isAutomatic?: boolean;
  reason?: string;
};

function approvalOf(content: ReadonlyArray<{ type: string }>) {
  return content.find((part) => part.type === "tool-approval-request") as
    | ApprovalPart
    | undefined;
}

function denialReason(content: ReadonlyArray<{ type: string; reason?: string }>) {
  const response = content.find((part) => part.type === "tool-approval-response");
  return response?.reason ?? "";
}

function person(role: Role): AppUser {
  return {
    id: "user-ops",
    email: "ops@c4m.test",
    name: "Ops",
    role,
    provider: "local",
  };
}

function replay(
  prompt: string,
  responseMessages: ModelMessage[],
  approvalId: string,
  approved: boolean
): ModelMessage[] {
  return [
    { role: "user", content: prompt },
    ...responseMessages,
    {
      role: "tool",
      content: [{ type: "tool-approval-response", approvalId, approved }],
    },
  ];
}

describe("agente", () => {
  let campaignId = "";
  let prisma: typeof import("@/lib/db").prisma;
  let createC4mAgent: typeof import("@/lib/agent/agent").createC4mAgent;
  let persistAgentTurn: typeof import("@/lib/agent/messages").persistAgentTurn;
  let clientThreadWhere: typeof import("@/lib/agent/messages").clientThreadWhere;

  before(async () => {
    ({ prisma } = await import("@/lib/db"));
    ({ createC4mAgent } = await import("@/lib/agent/agent"));
    ({ persistAgentTurn, clientThreadWhere } = await import("@/lib/agent/messages"));

    await prisma.creator.create({
      data: {
        handle: "sara",
        instagramUrl: "https://instagram.com/sara",
        displayName: "Sara",
        contactEmail: "sara@example.com",
        payoutCurrency: "EUR",
      },
    });
    const campaign = await prisma.campaign.create({
      data: { name: "Navidad test", status: "ACTIVE" },
    });
    campaignId = campaign.id;
  });

  after(async () => {
    await prisma?.$disconnect();
    rmSync(dir, { recursive: true, force: true });
  });

  test("la lectura no pide aprobación y no devuelve el email", async () => {
    const agent = createC4mAgent(
      { user: person("VIEWER"), context: { campaignId } },
      modelOf([
        toolResult("call-search", "searchRoster", { query: "sara" }),
        textResult("Sara está en el roster."),
      ])
    );
    const result = await agent.generate({ prompt: "¿Está Sara en el roster?" });
    const output = JSON.stringify(result.toolResults);

    assert.equal(result.text, "Sara está en el roster.");
    assert.equal(approvalOf(result.content), undefined);
    assert.match(output, /"handle":"sara"/);
    assert.doesNotMatch(output, /sara@example.com/);
    assert.equal(await prisma.campaignTalent.count(), 0);
    assert.equal(await prisma.auditEvent.count(), 0);
  });

  test("la escritura se detiene pidiendo aprobación", async () => {
    const prompt = "Mete a @sara en la mesa";
    const agent = createC4mAgent(
      { user: person("CREATORS"), context: { campaignId } },
      modelOf([toolResult("call-desk", "addToDesk", { handle: "sara" })])
    );
    const result = await agent.generate({ prompt });
    const approval = approvalOf(result.content);

    assert.ok(approval);
    assert.equal(approval.isAutomatic, undefined);
    assert.equal(await prisma.campaignTalent.count(), 0);
    assert.equal(await prisma.auditEvent.count(), 0);
  });

  test("aprobar ejecuta y deja AuditEvent a nombre de la IA", async () => {
    const prompt = "Mete a @sara en la mesa";
    const agent = createC4mAgent(
      { user: person("CREATORS"), context: { campaignId } },
      modelOf([
        toolResult("call-desk", "addToDesk", { handle: "sara" }),
        textResult("Listo."),
      ])
    );
    const pending = await agent.generate({ prompt });
    const approval = approvalOf(pending.content);
    assert.ok(approval);

    const done = await agent.generate({
      messages: replay(prompt, pending.responseMessages, approval.approvalId, true),
    });

    assert.equal(done.text, "Listo.");
    assert.equal(await prisma.campaignTalent.count(), 1);
    const audit = await prisma.auditEvent.findFirst({
      where: { action: "ROSTER_ADDED" },
    });
    assert.ok(audit);
    assert.equal(audit.actorEmail, "C4M IA en nombre de ops@c4m.test");
    assert.equal(audit.actorRole, "CREATORS");
  });

  test("descartar no escribe", async () => {
    const prompt = "Mete a @sara otra vez";
    const beforeCount = await prisma.campaignTalent.count();
    const beforeAudit = await prisma.auditEvent.count();
    const agent = createC4mAgent(
      { user: person("CREATORS"), context: { campaignId } },
      modelOf([
        toolResult("call-desk-2", "addToDesk", { handle: "sara" }),
        textResult("De acuerdo, no lo hago."),
      ])
    );
    const pending = await agent.generate({ prompt });
    const approval = approvalOf(pending.content);
    assert.ok(approval);

    await agent.generate({
      messages: replay(prompt, pending.responseMessages, approval.approvalId, false),
    });

    assert.equal(await prisma.campaignTalent.count(), beforeCount);
    assert.equal(await prisma.auditEvent.count(), beforeAudit);
  });

  test("un rol sin permiso se deniega y no escribe", async () => {
    const beforeCount = await prisma.campaignTalent.count();
    const agent = createC4mAgent(
      { user: person("VIEWER"), context: { campaignId } },
      modelOf([
        toolResult("call-denied", "addToDesk", { handle: "sara" }),
        textResult("No puedo meter perfiles."),
      ])
    );
    const result = await agent.generate({ prompt: "Mete a @sara" });
    const approval = approvalOf(result.content);

    assert.ok(approval?.isAutomatic);
    assert.match(denialReason(result.content), /no permite meter perfiles/);
    assert.equal(result.text, "No puedo meter perfiles.");
    assert.equal(await prisma.campaignTalent.count(), beforeCount);
    assert.equal(
      await prisma.auditEvent.count({ where: { action: "ROSTER_ADDED" } }),
      1
    );
  });

  test("la ruta sin sesión responde 401", async () => {
    const { POST } = await import("@/app/api/agent/route");
    const response = await POST(
      new Request("http://localhost/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              id: "m1",
              role: "user",
              parts: [{ type: "text", text: "hola" }],
            },
          ],
        }),
      })
    );
    assert.equal(response.status, 401);
  });

  test("los mensajes quedan INTERNAL y no salen en /hablar", async () => {
    await persistAgentTurn({
      campaignId,
      user: person("CREATORS"),
      question: "¿Quién va con retraso?",
      answer: "Todavía no hay publicados.",
    });
    await prisma.campaignMessage.create({
      data: {
        campaignId,
        authorKind: "CLIENT",
        authorLabel: "Cliente",
        body: "Visto.",
        visibility: "SHARED",
      },
    });

    const stored = await prisma.campaignMessage.findMany({
      where: { campaignId, authorKind: { in: ["AGENCY", "ASSISTANT"] } },
    });
    assert.equal(stored.length, 2);
    assert.ok(stored.every((message) => message.visibility === "INTERNAL"));
    assert.equal(
      stored.find((message) => message.authorKind === "ASSISTANT")?.authorLabel,
      "C4M IA en nombre de ops@c4m.test"
    );

    const visible = await prisma.campaignMessage.findMany({
      where: clientThreadWhere(campaignId),
    });
    assert.deepEqual(
      visible.map((message) => message.body),
      ["Visto."]
    );
  });
});

test("sin clave el panel no está listo", () => {
  assert.equal(aiSetup({ APP_ENV: "local" }), "missing-key");
  assert.equal(
    aiSetup({ APP_ENV: "local", AI_GATEWAY_API_KEY: "key" }),
    "missing-model"
  );
  assert.equal(
    aiSetup({
      APP_ENV: "prod",
      AI_GATEWAY_API_KEY: "key",
      C4M_AI_MODEL: "proveedor/modelo",
    }),
    "ready"
  );
  assert.equal(isLocalMockModel({ APP_ENV: "local", C4M_AI_MODEL: "mock/local" }), true);
  assert.equal(isLocalMockModel({ APP_ENV: "prod", C4M_AI_MODEL: "mock/local" }), false);
  assert.equal(
    aiSetup({ APP_ENV: "local", C4M_AI_MODEL: "mock/local" }),
    "ready"
  );
});
