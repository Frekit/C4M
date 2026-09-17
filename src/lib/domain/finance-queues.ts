import { PAYOUT_METHOD } from "@/lib/domain/enums";
import { isLiveDeliverable } from "@/lib/domain/rules";
import { packKey, packProgress } from "@/lib/domain/settlement";

export type FinancePublishRow = {
  id: string;
  position: number;
  postUrl: string;
  publishedAt: string | null;
  creatorHandle: string;
  contractCode: string;
  contractId: string;
  costMinor: number;
  costCurrency: string;
};

export type CampaignQueueGroup = {
  key: string;
  campaignId: string | null;
  campaignName: string;
  clientName: string | null;
  items: FinancePublishRow[];
};

export type PackQueueItem = {
  id: string;
  position: number;
  status: string;
  postUrl: string | null;
  publishedAt: string | null;
  costMinor: number;
  costCurrency: string;
};

export type PackQueueGroup = {
  key: string;
  campaignId: string;
  campaignName: string;
  clientName: string;
  creatorId: string;
  creatorHandle: string;
  published: number;
  total: number;
  isComplete: boolean;
  paymentDueAt: string | null;
  items: PackQueueItem[];
};

export type PayoutItem = {
  id: string;
  position: number;
  postUrl: string | null;
  paymentDueAt: string | null;
  clientSubmittedAt: string | null;
  costMinor: number;
  costCurrency: string;
  creatorHandle: string;
  contractCode: string;
  contractId: string;
};

export type PayoutGroup = {
  creatorId: string;
  creatorHandle: string;
  payeeName: string | null;
  payoutMethod: string | null;
  account: string | null;
  payoutCurrency: string | null;
  items: PayoutItem[];
};

export type PlatformQueueSource = {
  id: string;
  position: number;
  postUrl: string | null;
  publishedAt: Date | null;
  campaignId: string | null;
  campaignName: string | null;
  clientName: string | null;
  creatorHandle: string;
  contractCode: string;
  contractId: string;
  costMinor: number;
  costCurrency: string;
};

export type PackQueueSource = {
  id: string;
  position: number;
  status: string;
  postUrl: string | null;
  publishedAt: Date | null;
  paymentDueAt: Date | null;
  clientSubmittedAt: Date | null;
  campaignId: string;
  campaignName: string;
  clientName: string;
  creatorId: string;
  creatorHandle: string;
  contractId: string;
  contractCode: string;
  costMinor: number;
  costCurrency: string;
};

export type PayoutQueueSource = {
  id: string;
  position: number;
  postUrl: string | null;
  paymentDueAt: Date | null;
  clientSubmittedAt: Date | null;
  creatorId: string;
  creatorHandle: string;
  contractId: string;
  contractCode: string;
  costMinor: number;
  costCurrency: string;
};

export type PayeeSnapshot = {
  legalName: string;
  payoutMethod: string;
  wiseEmail: string | null;
  iban: string | null;
  payoutCurrency: string;
};

export type MissingPlatformLink = {
  creatorHandle: string;
  contractCode: string;
  position: number;
};

export function splitPlatformQueue(items: PlatformQueueSource[]): {
  groups: CampaignQueueGroup[];
  missingLink: MissingPlatformLink[];
  readyCount: number;
} {
  const missingLink: MissingPlatformLink[] = [];
  const groups = new Map<string, CampaignQueueGroup>();

  for (const item of items) {
    if (!item.postUrl) {
      missingLink.push({
        creatorHandle: item.creatorHandle,
        contractCode: item.contractCode,
        position: item.position,
      });
      continue;
    }

    const key = item.campaignId ?? "sin";
    const row: FinancePublishRow = {
      id: item.id,
      position: item.position,
      postUrl: item.postUrl,
      publishedAt: item.publishedAt?.toISOString() ?? null,
      creatorHandle: item.creatorHandle,
      contractCode: item.contractCode,
      contractId: item.contractId,
      costMinor: item.costMinor,
      costCurrency: item.costCurrency,
    };

    const existing = groups.get(key);
    if (existing) {
      existing.items.push(row);
    } else {
      groups.set(key, {
        key,
        campaignId: item.campaignId,
        campaignName: item.campaignName ?? "Sin campaña",
        clientName: item.clientName,
        items: [row],
      });
    }
  }

  return {
    groups: [...groups.values()],
    missingLink,
    readyCount: items.length - missingLink.length,
  };
}

export function groupPackQueue(items: PackQueueSource[]): PackQueueGroup[] {
  const buckets = new Map<string, PackQueueSource[]>();

  for (const item of items) {
    const key = packKey(item.campaignId, item.creatorId);
    const existing = buckets.get(key);
    if (existing) {
      existing.push(item);
    } else {
      buckets.set(key, [item]);
    }
  }

  const groups: PackQueueGroup[] = [];

  for (const [key, bucket] of buckets) {
    const progress = packProgress(bucket);
    const first = bucket[0];
    if (!first) continue;
    let paymentDueAt: string | null = null;

    for (const item of bucket) {
      if (item.paymentDueAt) {
        paymentDueAt = item.paymentDueAt.toISOString();
        break;
      }
    }

    groups.push({
      key,
      campaignId: first.campaignId,
      campaignName: first.campaignName,
      clientName: first.clientName,
      creatorId: first.creatorId,
      creatorHandle: first.creatorHandle,
      published: progress.published,
      total: progress.total,
      isComplete: progress.isComplete,
      paymentDueAt,
      items: bucket.map((item) => ({
        id: item.id,
        position: item.position,
        status: item.status,
        postUrl: item.postUrl,
        publishedAt: item.publishedAt?.toISOString() ?? null,
        costMinor: item.costMinor,
        costCurrency: item.costCurrency,
      })),
    });
  }

  return groups;
}

export function payableFromQueues(
  submitted: PayoutQueueSource[],
  packItems: PackQueueSource[],
  packGroups: PackQueueGroup[]
): PayoutQueueSource[] {
  const completeKeys = new Set(
    packGroups.filter((group) => group.isComplete).map((group) => group.key)
  );
  const seen = new Set<string>();
  const result: PayoutQueueSource[] = [];

  for (const item of submitted) {
    seen.add(item.id);
    result.push(item);
  }

  for (const item of packItems) {
    if (seen.has(item.id)) continue;
    if (!completeKeys.has(packKey(item.campaignId, item.creatorId))) continue;
    if (!isLiveDeliverable(item.status)) continue;
    seen.add(item.id);
    result.push(toPayoutSource(item));
  }

  return result;
}

export function groupPayoutQueue(
  items: PayoutQueueSource[],
  payeeByContractId: Map<string, PayeeSnapshot>
): PayoutGroup[] {
  const groups = new Map<string, PayoutGroup>();

  for (const item of items) {
    const row: PayoutItem = {
      id: item.id,
      position: item.position,
      postUrl: item.postUrl,
      paymentDueAt: item.paymentDueAt?.toISOString() ?? null,
      clientSubmittedAt: item.clientSubmittedAt?.toISOString() ?? null,
      costMinor: item.costMinor,
      costCurrency: item.costCurrency,
      creatorHandle: item.creatorHandle,
      contractCode: item.contractCode,
      contractId: item.contractId,
    };

    const existing = groups.get(item.creatorId);
    if (existing) {
      existing.items.push(row);
      continue;
    }

    const payee = payeeByContractId.get(item.contractId) ?? null;
    groups.set(item.creatorId, {
      creatorId: item.creatorId,
      creatorHandle: item.creatorHandle,
      payeeName: payee?.legalName ?? null,
      payoutMethod: payee?.payoutMethod ?? null,
      account:
        payee?.payoutMethod === PAYOUT_METHOD.WISE
          ? (payee.wiseEmail ?? null)
          : (payee?.iban ?? null),
      payoutCurrency: payee?.payoutCurrency ?? null,
      items: [row],
    });
  }

  return [...groups.values()];
}

function toPayoutSource(item: PackQueueSource): PayoutQueueSource {
  return {
    id: item.id,
    position: item.position,
    postUrl: item.postUrl,
    paymentDueAt: item.paymentDueAt,
    clientSubmittedAt: item.clientSubmittedAt,
    creatorId: item.creatorId,
    creatorHandle: item.creatorHandle,
    contractId: item.contractId,
    contractCode: item.contractCode,
    costMinor: item.costMinor,
    costCurrency: item.costCurrency,
  };
}
