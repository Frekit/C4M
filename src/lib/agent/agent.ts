import {
  ToolLoopAgent,
  isStepCount,
  type LanguageModel,
  type ModelMessage,
} from "ai";

import {
  agentMaxSteps,
  aiFallbackModelId,
  aiModelId,
  toolApprovalSecret,
} from "./config";
import { AGENT_INSTRUCTIONS } from "./prompt";
import { sanitizeModelMessages } from "./errors";
import { createC4mToolset } from "./tools";
import type { AgentSession } from "./commands";

function stripApprovalSchemaInput(messages: ModelMessage[]): ModelMessage[] {
  return messages.map((message) => {
    if (message.role !== "assistant" || !Array.isArray(message.content)) return message;
    return {
      ...message,
      content: message.content.map((part) => {
        if (part.type !== "tool-approval-request" || !("inputSchemaInput" in part)) return part;
        const next = { ...part };
        delete next.inputSchemaInput;
        return next;
      }),
    };
  }) as ModelMessage[];
}

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

  const agent = new ToolLoopAgent({
    model: resolved,
    instructions: AGENT_INSTRUCTIONS,
    tools,
    toolApproval,
    stopWhen: isStepCount(agentMaxSteps()),
    maxOutputTokens: 1200,
    experimental_toolApprovalSecret: secret,
    experimental_refineToolInput: refineToolInput,
    prepareStep: ({ messages }) => ({ messages: sanitizeModelMessages(messages) }),
    providerOptions:
      !model && fallback
        ? { gateway: { models: [fallback] } }
        : undefined,
  });

  const generate = agent.generate.bind(agent);
  const stream = agent.stream.bind(agent);
  type GenerateArgs = Parameters<typeof generate>[0];
  type StreamArgs = Parameters<typeof stream>[0];
  agent.generate = ((options: GenerateArgs) => {
    if (!options.messages) return generate(options);
    return generate({
      ...options,
      messages: stripApprovalSchemaInput(options.messages),
    } as GenerateArgs);
  }) as typeof agent.generate;
  agent.stream = ((options: StreamArgs) => {
    if (!options.messages) return stream(options);
    return stream({
      ...options,
      messages: stripApprovalSchemaInput(options.messages),
    } as StreamArgs);
  }) as typeof agent.stream;
  return agent;
}
