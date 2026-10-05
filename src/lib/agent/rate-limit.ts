import { agentRatePerMinute } from "./config";

const hits = new Map<string, number[]>();
const WINDOW_MS = 60_000;

/** Límite por proceso y por usuario. No se comparte entre instancias. */
export function consumeAgentRate(userId: string, now = Date.now()) {
  const limit = agentRatePerMinute();
  const recent = (hits.get(userId) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= limit) {
    hits.set(userId, recent);
    return { ok: false as const, limit };
  }
  recent.push(now);
  hits.set(userId, recent);
  return { ok: true as const, limit };
}

export function resetAgentRate() {
  hits.clear();
}
