import { MockLanguageModelV4 } from "ai/test";
import type {
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamPart,
  LanguageModelV4StreamResult,
} from "@ai-sdk/provider";

const usage: LanguageModelV4GenerateResult["usage"] = {
  inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 12, text: 12, reasoning: 0 },
};

function toolCall(
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

function text(value: string): LanguageModelV4GenerateResult {
  return {
    content: [{ type: "text", text: value }],
    finishReason: { unified: "stop", raw: undefined },
    usage,
    warnings: [],
  };
}

function streamResult(parts: LanguageModelV4StreamPart[]): LanguageModelV4StreamResult {
  return {
    stream: new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(part);
        controller.close();
      },
    }),
  };
}

function toolStream(toolCallId: string, toolName: string, input: Record<string, unknown>) {
  return streamResult([
    { type: "stream-start", warnings: [] },
    {
      type: "tool-call",
      toolCallId,
      toolName,
      input: JSON.stringify(input),
    },
    {
      type: "finish",
      usage,
      finishReason: { unified: "tool-calls", raw: undefined },
    },
  ]);
}

function textStream(value: string) {
  return streamResult([
    { type: "stream-start", warnings: [] },
    { type: "text-start", id: "text-1" },
    { type: "text-delta", id: "text-1", delta: value },
    { type: "text-end", id: "text-1" },
    {
      type: "finish",
      usage,
      finishReason: { unified: "stop", raw: undefined },
    },
  ]);
}

function proposesDesk(prompt: unknown) {
  const serialized = JSON.stringify(prompt);
  return (
    !serialized.includes("tool-approval-response") &&
    !serialized.includes("tool-result")
  );
}

/**
 * Modelo simulado para APP_ENV=local y C4M_AI_MODEL=mock/local.
 * Propone meter a @sarabakes en la mesa y, tras la aprobación, cierra con texto.
 * No sale a la red.
 */
export function createLocalFixtureModel() {
  const reply = "Hecho. @sarabakes está en la mesa. No he inventado el handle.";
  return new MockLanguageModelV4({
    doGenerate: async ({ prompt }) =>
      proposesDesk(prompt)
        ? toolCall("call-desk", "addToDesk", { handle: "sarabakes" })
        : text(reply),
    doStream: async ({ prompt }) =>
      proposesDesk(prompt)
        ? toolStream("call-desk", "addToDesk", { handle: "sarabakes" })
        : textStream(reply),
  });
}
