export type AgentRouteContext = {
  campaignId?: string;
  contractId?: string;
  creatorId?: string;
};

const ID = /^[A-Za-z0-9_-]{1,64}$/;

function clean(value: unknown) {
  if (typeof value !== "string") return undefined;
  const id = value.trim();
  if (!ID.test(id)) return undefined;
  return id;
}

export function contextFromPathname(pathname: string): AgentRouteContext {
  const campaign = pathname.match(/^\/campanas\/([^/]+)/);
  if (campaign && campaign[1] !== "nueva") {
    return { campaignId: decodeURIComponent(campaign[1]) };
  }
  const contract = pathname.match(/^\/contratos\/([^/]+)/);
  if (contract) return { contractId: decodeURIComponent(contract[1]) };
  const creator = pathname.match(/^\/creators\/([^/]+)/);
  if (creator) return { creatorId: decodeURIComponent(creator[1]) };
  return {};
}

export function routeChip(pathname: string) {
  if (pathname.startsWith("/campanas/")) return "Campaña · Planilla";
  if (pathname.startsWith("/contratos/")) return "Contrato";
  if (pathname.startsWith("/contenidos")) return "Contenidos";
  if (pathname.startsWith("/creators/")) return "Creator";
  if (pathname === "/") return "Centro de acciones";
  return "Esta pantalla";
}

export function parseRouteContext(value: unknown): AgentRouteContext {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  return {
    campaignId: clean(record.campaignId),
    contractId: clean(record.contractId),
    creatorId: clean(record.creatorId),
  };
}

export function boundId(contextId: string | undefined, requested: string | undefined) {
  if (contextId && requested && contextId !== requested) {
    return { ok: false as const, error: "Ese identificador no es el de esta pantalla." };
  }
  const id = contextId || requested;
  if (!id) return { ok: false as const, error: "Falta el identificador." };
  return { ok: true as const, id };
}
