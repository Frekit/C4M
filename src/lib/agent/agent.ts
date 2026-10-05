import {
  ToolLoopAgent,
  isStepCount,
  type LanguageModel,
} from "ai";

import {
  agentMaxSteps,
  aiFallbackModelId,
  aiModelId,
} from "./config";
import { AGENT_INSTRUCTIONS } from "./prompt";
import { createC4mToolset } from "./tools";
import type { AgentSession } from "./commands";

export function createC4mAgent(
  session: AgentSession,
  model?: LanguageModel
) {
  const { tools, toolApproval } = createC4mToolset(session);
  const fallback = aiFallbackModelId();
  const resolved = model ?? aiModelId();
  if (!resolved) {
    throw new Error("Falta C4M_AI_MODEL (proveedor/modelo).");
  }

  return new ToolLoopAgent({
    model: resolved,
    instructions: AGENT_INSTRUCTIONS,
    tools,
    toolApproval,
    stopWhen: isStepCount(agentMaxSteps()),
    maxOutputTokens: 1200,
    experimental_toolApprovalSecret: process.env.TOOL_APPROVAL_SECRET,
    providerOptions:
      !model && fallback
        ? { gateway: { models: [fallback] } }
        : undefined,
  });
}
