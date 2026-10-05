import {
  ToolLoopAgent,
  isStepCount,
  type LanguageModel,
} from "ai";

import {
  agentMaxSteps,
  aiFallbackModelId,
  aiModelId,
  toolApprovalSecret,
} from "./config";
import { AGENT_INSTRUCTIONS } from "./prompt";
import { createC4mToolset } from "./tools";
import type { AgentSession } from "./commands";

export function createC4mAgent(
  session: AgentSession,
  model?: LanguageModel
) {
  const { tools, toolApproval, refineToolInput } = createC4mToolset(session);
  const fallback = aiFallbackModelId();
  const resolved = model ?? aiModelId();
  const secret = toolApprovalSecret();
  if (!resolved) {
    throw new Error("Falta C4M_AI_MODEL (proveedor/modelo).");
  }
  if (!secret) {
    throw new Error("Falta TOOL_APPROVAL_SECRET.");
  }

  return new ToolLoopAgent({
    model: resolved,
    instructions: AGENT_INSTRUCTIONS,
    tools,
    toolApproval,
    stopWhen: isStepCount(agentMaxSteps()),
    maxOutputTokens: 1200,
    experimental_toolApprovalSecret: secret,
    experimental_refineToolInput: refineToolInput,
    providerOptions:
      !model && fallback
        ? { gateway: { models: [fallback] } }
        : undefined,
  });
}
