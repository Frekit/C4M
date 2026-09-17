import { cache } from "react";

import { prisma } from "@/lib/db";
import {
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
  FINANCE_PAGE_SIZE,
  SIGNATURE_STATUS,
} from "@/lib/domain/enums";
import {
  groupPackQueue,
  groupPayoutQueue,
  payableFromQueues,
  type CampaignQueueGroup,
  type FinancePublishRow,
  type PayeeSnapshot,
  type PackQueueSource,
  type PlatformQueueSource,
  type PayoutQueueSource,
} from "@/lib/domain/finance-queues";
import { loadPackCampaignIds } from "@/lib/domain/pack-sync";
import { parsePage } from "@/lib/domain/paging";

const liveContract = {
  status: { not: CONTRACT_STATUS.CANCELLED },
} as const;

export type FinanceFilters = {
  campana?: string;
  pagina?: string;
};

export type FinanceCampaignSummary = {
  campaignId: string;
  campaignName: string;
  clientName: string | null;
  count: number;
};

const platformSelect = {
  id: true,
  position: true,
  postUrl: true,
  publishedAt: true,
  campaignId: true,
  contractId: true,
  platformSubmitError: true,
  platformSubmitErrorAt: true,
  campaign: {
    select: {
      name: true,
      client: { select: { name: true } },
    },
  },
  contract: {
    select: {
      code: true,
      creatorId: true,
      costMinorPerContent: true,
      costCurrency: true,
      creator: { select: { handle: true } },
    },
  },
} as const;

const loadPlatformCampaignIds = cache(async () => {
  const clients = await prisma.client.findMany({
    where: { requiresPlatformSubmit: true },
    select: { id: true },
  });

  if (clients.length === 0) return [] as string[];

  const campaigns = await prisma.campaign.findMany({
    where: { clientId: { in: clients.map((client) => client.id) } },
    select: { id: true },
  });

  return campaigns.map((campaign) => campaign.id);
});

export function platformReadyWhere(campaignIds: string[]) {
  return {
    status: DELIVERABLE_STATUS.PUBLISHED,
    paidAt: null,
    platformSubmitError: null,
    postUrl: { not: null },
    campaignId: { in: campaignIds },
    contract: liveContract,
  } as const;
}

function toPlatformSource(
  item: {
    id: string;
    position: number;
    postUrl: string | null;
    publishedAt: Date | null;
    campaignId: string | null;
    contractId: string;
    platformSubmitError: string | null;
    platformSubmitErrorAt: Date | null;
    campaign: { name: string; client: { name: string } | null } | null;
    contract: {
      code: string;
      creatorId: string;
      costMinorPerContent: number;
      costCurrency: string;
      creator: { handle: string };
    };
  }
): PlatformQueueSource | null {
  if (!item.postUrl) return null;
  return {
    id: item.id,
    position: item.position,
    postUrl: item.postUrl,
    publishedAt: item.publishedAt,
    campaignId: item.campaignId,
    campaignName: item.campaign?.name ?? null,
    clientName: item.campaign?.client?.name ?? null,
    creatorHandle: item.contract.creator.handle,
    contractCode: item.contract.code,
    contractId: item.contractId,
    costMinor: item.contract.costMinorPerContent,
    costCurrency: item.contract.costCurrency,
    platformSubmitError: item.platformSubmitError,
    platformSubmitErrorAt: item.platformSubmitErrorAt,
  };
}

function toPublishRow(item: PlatformQueueSource): FinancePublishRow {
  return {
    id: item.id,
    position: item.position,
    postUrl: item.postUrl ?? "",
    publishedAt: item.publishedAt?.toISOString() ?? null,
    creatorHandle: item.creatorHandle,
    contractCode: item.contractCode,
    contractId: item.contractId,
    costMinor: item.costMinor,
    costCurrency: item.costCurrency,
    platformSubmitError: item.platformSubmitError,
    platformSubmitErrorAt: item.platformSubmitErrorAt?.toISOString() ?? null,
  };
}

function pageGroups<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  return {
    slice: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

export async function loadFinanceQueues(filters: FinanceFilters = {}) {
  const page = parsePage(filters.pagina);
  const [platformCampaignIds, packCampaignIds] = await Promise.all([
    loadPlatformCampaignIds(),
    loadPackCampaignIds(),
  ]);

  const requestedCampaign = filters.campana?.trim() || null;

  const platformWhereIds = requestedCampaign
    ? platformCampaignIds.filter((id) => id === requestedCampaign)
    : platformCampaignIds;
  const packWhereIds = requestedCampaign
    ? packCampaignIds.filter((id) => id === requestedCampaign)
    : packCampaignIds;

  const readyWhere = platformReadyWhere(platformWhereIds);
  const errorWhere = {
    status: DELIVERABLE_STATUS.PUBLISHED,
    paidAt: null,
    platformSubmitError: { not: null },
    campaignId: { in: platformWhereIds },
    contract: liveContract,
  };
  const missingWhere = {
    status: DELIVERABLE_STATUS.PUBLISHED,
    paidAt: null,
    postUrl: null,
    campaignId: { in: platformWhereIds },
    contract: liveContract,
  };

  const [
    readyCount,
    errorCount,
    missingLinkCount,
    readyRows,
    errorRows,
    packRows,
    submittedRows,
    recentPaidRows,
    platformSummaryRows,
  ] = await Promise.all([
    platformWhereIds.length === 0
      ? Promise.resolve(0)
      : prisma.deliverable.count({ where: readyWhere }),
    platformWhereIds.length === 0
      ? Promise.resolve(0)
      : prisma.deliverable.count({ where: errorWhere }),
    platformWhereIds.length === 0
      ? Promise.resolve(0)
      : prisma.deliverable.count({ where: missingWhere }),
    platformWhereIds.length === 0
      ? Promise.resolve([])
      : prisma.deliverable.findMany({
          where: readyWhere,
          orderBy: [{ publishedAt: "asc" }, { position: "asc" }],
          skip: (page - 1) * FINANCE_PAGE_SIZE,
          take: FINANCE_PAGE_SIZE,
          select: platformSelect,
        }),
    platformWhereIds.length === 0
      ? Promise.resolve([])
      : prisma.deliverable.findMany({
          where: errorWhere,
          orderBy: [{ platformSubmitErrorAt: "desc" }],
          take: FINANCE_PAGE_SIZE,
          select: platformSelect,
        }),
    packWhereIds.length === 0
      ? Promise.resolve([])
      : prisma.deliverable.findMany({
          where: {
            campaignId: { in: packWhereIds },
            contract: liveContract,
          },
          orderBy: [{ publishedAt: "asc" }, { position: "asc" }],
          select: {
            id: true,
            position: true,
            status: true,
            postUrl: true,
            publishedAt: true,
            paymentDueAt: true,
            clientSubmittedAt: true,
            paidAt: true,
            campaignId: true,
            contractId: true,
            campaign: {
              select: {
                name: true,
                client: { select: { name: true } },
              },
            },
            contract: {
              select: {
                code: true,
                creatorId: true,
                costMinorPerContent: true,
                costCurrency: true,
                creator: { select: { handle: true } },
              },
            },
          },
        }),
    prisma.deliverable.findMany({
      where: {
        status: DELIVERABLE_STATUS.SUBMITTED,
        paidAt: null,
        contract: liveContract,
        ...(packCampaignIds.length > 0
          ? { NOT: { campaignId: { in: packCampaignIds } } }
          : {}),
        ...(requestedCampaign ? { campaignId: requestedCampaign } : {}),
      },
      orderBy: [{ paymentDueAt: "asc" }, { position: "asc" }],
      take: requestedCampaign ? 2000 : 200,
      select: {
        id: true,
        position: true,
        postUrl: true,
        paymentDueAt: true,
        clientSubmittedAt: true,
        paidAt: true,
        contractId: true,
        contract: {
          select: {
            code: true,
            creatorId: true,
            costMinorPerContent: true,
            costCurrency: true,
            creator: { select: { handle: true } },
          },
        },
      },
    }),
    prisma.deliverable.findMany({
      where: {
        paidAt: { not: null },
        contract: liveContract,
        ...(requestedCampaign ? { campaignId: requestedCampaign } : {}),
      },
      orderBy: { paidAt: "desc" },
      take: 12,
      select: {
        id: true,
        position: true,
        paidAt: true,
        contractId: true,
        contract: {
          select: {
            code: true,
            costMinorPerContent: true,
            costCurrency: true,
            creator: { select: { handle: true } },
          },
        },
      },
    }),
    platformCampaignIds.length === 0
      ? Promise.resolve([])
      : prisma.deliverable.groupBy({
          by: ["campaignId"],
          where: platformReadyWhere(platformCampaignIds),
          _count: { _all: true },
        }),
  ]);

  const campaignMeta = await prisma.campaign.findMany({
    where: {
      id: {
        in: platformSummaryRows
          .map((row) => row.campaignId)
          .filter((id): id is string => Boolean(id)),
      },
    },
    select: {
      id: true,
      name: true,
      client: { select: { name: true } },
    },
  });
  const campaignById = new Map(campaignMeta.map((campaign) => [campaign.id, campaign]));

  const platformSummaries: FinanceCampaignSummary[] = platformSummaryRows.flatMap(
    (row) => {
      if (!row.campaignId) return [];
      const meta = campaignById.get(row.campaignId);
      return [
        {
          campaignId: row.campaignId,
          campaignName: meta?.name ?? "Campaña",
          clientName: meta?.client?.name ?? null,
          count: row._count._all,
        },
      ];
    }
  );

  const readySources = readyRows.flatMap((item) => {
    const source = toPlatformSource(item);
    return source ? [source] : [];
  });
  const errorSources = errorRows.flatMap((item) => {
    const source = toPlatformSource(item);
    return source ? [source] : [];
  });

  function groupFromSources(
    sources: PlatformQueueSource[],
    total: number
  ): CampaignQueueGroup[] {
    if (sources.length === 0) return [];
    const first = sources[0];
    if (!first) return [];
    return [
      {
        key: first.campaignId ?? "sin",
        campaignId: first.campaignId,
        campaignName: first.campaignName ?? "Sin campaña",
        clientName: first.clientName,
        items: sources.map(toPublishRow),
        total,
        page,
        pageSize: FINANCE_PAGE_SIZE,
      },
    ];
  }

  const packItems: PackQueueSource[] = packRows.flatMap((item) => {
    if (!item.campaignId) return [];
    return [
      {
        id: item.id,
        position: item.position,
        status: item.status,
        postUrl: item.postUrl,
        publishedAt: item.publishedAt,
        paymentDueAt: item.paymentDueAt,
        clientSubmittedAt: item.clientSubmittedAt,
        paidAt: item.paidAt,
        campaignId: item.campaignId,
        campaignName: item.campaign?.name ?? "Campaña",
        clientName: item.campaign?.client?.name ?? "Cliente",
        creatorId: item.contract.creatorId,
        creatorHandle: item.contract.creator.handle,
        contractId: item.contractId,
        contractCode: item.contract.code,
        costMinor: item.contract.costMinorPerContent,
        costCurrency: item.contract.costCurrency,
      },
    ];
  });

  const submittedItems: PayoutQueueSource[] = submittedRows.map((item) => ({
    id: item.id,
    position: item.position,
    postUrl: item.postUrl,
    paymentDueAt: item.paymentDueAt,
    clientSubmittedAt: item.clientSubmittedAt,
    paidAt: item.paidAt,
    creatorId: item.contract.creatorId,
    creatorHandle: item.contract.creator.handle,
    contractId: item.contractId,
    contractCode: item.contract.code,
    costMinor: item.contract.costMinorPerContent,
    costCurrency: item.contract.costCurrency,
  }));

  const allPackGroups = groupPackQueue(packItems);
  const openPackGroups = allPackGroups.filter((group) => !group.allPaid);
  const pagedPacks = pageGroups(openPackGroups, page, FINANCE_PAGE_SIZE);
  const payableItems = payableFromQueues(
    submittedItems,
    packItems,
    allPackGroups
  );

  const contractIds = [
    ...new Set(payableItems.map((item) => item.contractId)),
  ];

  const signedRequests =
    contractIds.length === 0
      ? []
      : await prisma.signatureRequest.findMany({
          where: {
            status: SIGNATURE_STATUS.SIGNED,
            contractId: { in: contractIds },
          },
          select: {
            contractId: true,
            payee: {
              select: {
                legalName: true,
                billingEmail: true,
                payoutCurrency: true,
              },
            },
          },
        });

  const payeeByContractId = new Map<string, PayeeSnapshot>();
  for (const request of signedRequests) {
    if (payeeByContractId.has(request.contractId) || !request.payee) continue;
    payeeByContractId.set(request.contractId, request.payee);
  }

  const payoutGroups = groupPayoutQueue(payableItems, payeeByContractId);
  const pagedPayouts = pageGroups(payoutGroups, page, FINANCE_PAGE_SIZE);

  return {
    platformSummaries,
    platformGroups: groupFromSources(readySources, readyCount),
    platformErrorGroups: groupFromSources(errorSources, errorCount),
    missingLinkCount,
    readyToUploadCount: readyCount,
    platformErrorCount: errorCount,
    packGroups: pagedPacks.slice,
    packTotal: pagedPacks.total,
    packPage: pagedPacks.page,
    readyPacks: openPackGroups.filter((group) => group.isComplete).length,
    payoutGroups: pagedPayouts.slice,
    payoutTotal: pagedPayouts.total,
    payableCount: payableItems.length,
    page,
    pageSize: FINANCE_PAGE_SIZE,
    campaignId: requestedCampaign,
    recentPaid: recentPaidRows.flatMap((item) => {
      if (!item.paidAt) return [];
      return [
        {
          id: item.id,
          position: item.position,
          paidAt: item.paidAt.toISOString(),
          costMinor: item.contract.costMinorPerContent,
          costCurrency: item.contract.costCurrency,
          creatorHandle: item.contract.creator.handle,
          contractCode: item.contract.code,
          contractId: item.contractId,
        },
      ];
    }),
  };
}

export async function listPlatformReadyIds(campaignIds: string[], take: number) {
  if (campaignIds.length === 0) return [] as string[];
  const rows = await prisma.deliverable.findMany({
    where: platformReadyWhere(campaignIds),
    orderBy: [{ publishedAt: "asc" }, { position: "asc" }],
    take,
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export async function listPlatformReadyUrls(campaignIds: string[], take: number) {
  if (campaignIds.length === 0) return [] as string[];
  const rows = await prisma.deliverable.findMany({
    where: platformReadyWhere(campaignIds),
    orderBy: [{ publishedAt: "asc" }, { position: "asc" }],
    take,
    select: { postUrl: true },
  });
  return rows
    .map((row) => row.postUrl?.trim())
    .filter((url): url is string => Boolean(url));
}
