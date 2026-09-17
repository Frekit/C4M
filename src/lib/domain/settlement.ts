import { SETTLEMENT_MODE } from "@/lib/domain/enums";
import { paymentDueDate } from "@/lib/domain/contract-math";
import { isLiveDeliverable } from "@/lib/domain/rules";

export type SettlementPolicy = {
  settlementMode: string;
  requiresPlatformSubmit: boolean;
};

export const DEFAULT_SETTLEMENT: SettlementPolicy = {
  settlementMode: SETTLEMENT_MODE.PER_CONTENT,
  requiresPlatformSubmit: true,
};

export function isPackSettlement(policy: SettlementPolicy | null | undefined) {
  return policy?.settlementMode === SETTLEMENT_MODE.PACK;
}

export function packKey(campaignId: string, creatorId: string) {
  return `${campaignId}:${creatorId}`;
}

export type PackProgress = {
  total: number;
  published: number;
  isComplete: boolean;
};

export function packProgress(
  items: { status: string }[]
): PackProgress {
  const total = items.length;
  const published = items.filter((item) => isLiveDeliverable(item.status)).length;

  return {
    total,
    published,
    isComplete: total > 0 && published === total,
  };
}

export function isAccruedDeliverable(
  status: string,
  policy: SettlementPolicy | null | undefined,
  packComplete: boolean
): boolean {
  if (!isLiveDeliverable(status)) return false;
  if (isPackSettlement(policy)) return packComplete;
  return true;
}

export function isPayableWithPolicy(
  status: string,
  policy: SettlementPolicy | null | undefined,
  packComplete: boolean
): boolean {
  if (!isLiveDeliverable(status)) return false;

  if (isPackSettlement(policy)) {
    return packComplete;
  }

  if (policy?.requiresPlatformSubmit === false) {
    return true;
  }

  return status === "SUBMITTED";
}

export function packPaymentDueAt(
  items: { status: string; publishedAt: Date | null }[],
  paymentTermDays: number
): Date | null {
  const progress = packProgress(items);
  if (!progress.isComplete) return null;

  const last = items.reduce<Date | null>((latest, item) => {
    if (!item.publishedAt) return latest;
    if (!latest || item.publishedAt > latest) return item.publishedAt;
    return latest;
  }, null);

  if (!last) return null;
  return paymentDueDate(last, paymentTermDays);
}

export function summarizePacks(
  items: {
    campaignId: string | null;
    creatorId: string;
    status: string;
  }[]
): Map<string, PackProgress> {
  const grouped = new Map<string, { status: string }[]>();

  for (const item of items) {
    if (!item.campaignId) continue;
    const key = packKey(item.campaignId, item.creatorId);
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }

  const result = new Map<string, PackProgress>();
  for (const [key, list] of grouped) {
    result.set(key, packProgress(list));
  }
  return result;
}
