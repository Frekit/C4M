import { MockLanguageModelV4 } from "ai/test";
import type { LanguageModelV4GenerateResult } from "@ai-sdk/provider";

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

/**
 * Modelo simulado para APP_ENV=local y C4M_AI_MODEL=mock/local.
 * Propone meter a @sarabakes en la mesa y, tras la aprobación, cierra con texto.
 * No sale a la red.
 */
export function createLocalFixtureModel() {
  return new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      const serialized = JSON.stringify(prompt);
      if (serialized.includes("tool-approval-response")) {
        return text("Hecho. @sarabakes está en la mesa. No he inventado el handle.");
      }
      return toolCall("call-desk", "addToDesk", { handle: "sarabakes" });
    },
  });
}
