import { CONTRACT_STATUS, DELIVERABLE_STATUS } from "@/lib/domain/enums";
import {
  isPayableWithPolicy,
  packKey,
  settlementPolicyOf,
  type SettlementPolicy,
} from "@/lib/domain/settlement";

export const PLATFORM_ERROR_MAX = 400;
export const PLATFORM_ERROR_MIN = 3;

export type FinanceCommandResult =
  | { ok: true }
  | { ok: false; error: string };

export type PlatformCommandItem = {
  status: string;
  postUrl: string | null;
  requiresPlatformSubmit: boolean | null | undefined;
  platformSubmitError: string | null;
};

export type PaidCommandItem = {
  paidAt: Date | null;
  contractStatus: string;
  status: string;
  campaignId: string | null;
  creatorId: string;
  policy: SettlementPolicy | null;
};

export function parseSelectedIds(formData: FormData): string[] {
  return formData.getAll("deliverableIds").map(String).filter(Boolean);
}

export function parsePlatformErrorReason(
  raw: unknown
): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = String(raw ?? "").trim();

  if (reason.length < PLATFORM_ERROR_MIN) {
    return {
      ok: false,
      error: "Escribe por qué ha fallado la subida (mínimo unas palabras).",
    };
  }

  if (reason.length > PLATFORM_ERROR_MAX) {
    return {
      ok: false,
      error: `La nota no puede pasar de ${PLATFORM_ERROR_MAX} caracteres.`,
    };
  }

  return { ok: true, reason };
}

export function assertIdsSelected(ids: string[]): FinanceCommandResult {
  if (ids.length === 0) {
    return { ok: false, error: "No has seleccionado ningún contenido." };
  }
  return { ok: true };
}

export function assertFoundAll(
  foundCount: number,
  requestedCount: number
): FinanceCommandResult {
  if (foundCount !== requestedCount) {
    return { ok: false, error: "Alguno de esos contenidos ya no existe." };
  }
  return { ok: true };
}

function assertPlatformClient(
  items: PlatformCommandItem[],
  message: string
): FinanceCommandResult {
  if (items.some((item) => item.requiresPlatformSubmit !== true)) {
    return { ok: false, error: message };
  }
  return { ok: true };
}

function assertPublishedWithUrl(
  items: PlatformCommandItem[],
  message: string
): FinanceCommandResult {
  if (
    items.some(
      (item) =>
        item.status !== DELIVERABLE_STATUS.PUBLISHED || !item.postUrl
    )
  ) {
    return { ok: false, error: message };
  }
  return { ok: true };
}

export function assertCanSubmitToPlatform(
  items: PlatformCommandItem[]
): FinanceCommandResult {
  const platform = assertPlatformClient(
    items,
    "Ese cliente no tiene plataforma: con Publicado en redes ya está entregado."
  );
  if (!platform.ok) return platform;

  return assertPublishedWithUrl(
    items,
    "Solo se pueden subir los que están publicados y tienen enlace del post."
  );
}

export function assertCanMarkPlatformError(
  items: PlatformCommandItem[]
): FinanceCommandResult {
  const platform = assertPlatformClient(
    items,
    "Ese cliente no tiene plataforma: no hay subida que marcar."
  );
  if (!platform.ok) return platform;

  return assertPublishedWithUrl(
    items,
    "Solo se puede marcar error en publicados que ya tienen enlace del post."
  );
}

export function assertCanClearPlatformError(
  items: PlatformCommandItem[]
): FinanceCommandResult {
  if (
    items.some(
      (item) =>
        item.status !== DELIVERABLE_STATUS.PUBLISHED ||
        !item.platformSubmitError
    )
  ) {
    return {
      ok: false,
      error: "Solo se puede devolver a la cola lo que está en error de subida.",
    };
  }
  return { ok: true };
}

export function assertCanMarkPaid(
  items: PaidCommandItem[],
  packCompleteByKey: Map<string, boolean>
): FinanceCommandResult {
  if (items.some((item) => item.paidAt)) {
    return { ok: false, error: "Alguno ya estaba marcado como pagado." };
  }

  if (items.some((item) => item.contractStatus === CONTRACT_STATUS.CANCELLED)) {
    return { ok: false, error: "No se puede pagar un contrato cancelado." };
  }

  const notPayable = items.some((item) => {
    const complete = item.campaignId
      ? (packCompleteByKey.get(packKey(item.campaignId, item.creatorId)) ??
        false)
      : false;
    return !isPayableWithPolicy(item.status, item.policy, complete);
  });

  if (notPayable) {
    return {
      ok: false,
      error:
        "Solo se puede pagar lo que ya está en cola: submitted en plataforma, o el pack cerrado.",
    };
  }

  return { ok: true };
}

export function platformFlagOf(item: {
  campaign?: { client?: { requiresPlatformSubmit?: boolean } | null } | null;
}): boolean | undefined {
  return item.campaign?.client?.requiresPlatformSubmit;
}

export function paidPolicyOf(item: {
  contract: { client: SettlementPolicy | null };
  campaign: { client?: SettlementPolicy | null } | null;
}): SettlementPolicy | null {
  return settlementPolicyOf({
    client: item.contract.client,
    campaign: item.campaign,
  });
}
