export const AGENT_MAX_MESSAGES = 40;
export const AGENT_MAX_TEXT_CHARS = 8_000;
export const AGENT_MAX_BODY_BYTES = 200_000;

export type AiSetup = "ready" | "missing-key" | "missing-model";

export type AiEnv = {
  APP_ENV?: string;
  AI_GATEWAY_API_KEY?: string;
  C4M_AI_MODEL?: string;
  C4M_AI_FALLBACK_MODEL?: string;
  C4M_AI_MAX_STEPS?: string;
};

function modelId(value: string | undefined) {
  const id = value?.trim() ?? "";
  if (!id.includes("/")) return "";
  return id;
}

function envOf(env?: AiEnv): AiEnv {
  return env ?? (process.env as AiEnv);
}

export function aiModelId(env?: AiEnv) {
  return modelId(envOf(env).C4M_AI_MODEL);
}

export function aiFallbackModelId(env?: AiEnv) {
  return modelId(envOf(env).C4M_AI_FALLBACK_MODEL);
}

/** Fixture local: no llama a la red. Solo con APP_ENV=local. */
export function isLocalMockModel(env?: AiEnv) {
  const current = envOf(env);
  return current.APP_ENV === "local" && current.C4M_AI_MODEL?.trim() === "mock/local";
}

export function aiSetup(env?: AiEnv): AiSetup {
  const current = envOf(env);
  if (isLocalMockModel(current)) return "ready";
  if (!current.AI_GATEWAY_API_KEY?.trim()) return "missing-key";
  if (!aiModelId(current)) return "missing-model";
  return "ready";
}

export function isAiConfigured(env?: AiEnv) {
  return aiSetup(env) === "ready";
}

export function agentMaxSteps(env?: AiEnv) {
  const raw = Number.parseInt(envOf(env).C4M_AI_MAX_STEPS ?? "8", 10);
  if (!Number.isFinite(raw)) return 8;
  return Math.min(12, Math.max(1, raw));
}

export function aiActorLabel(email: string) {
  return `C4M IA en nombre de ${email}`;
}
