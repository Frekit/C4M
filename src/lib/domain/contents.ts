import { prisma } from "@/lib/db";
import {
  CONTENTS_PAGE_SIZE,
  buildDeliverableWhere,
  buildLateDeliverableWhere,
  parsePage,
  statusCountsFromGroup,
  withLiveStatus,
  type ContentFilters,
} from "@/lib/domain/contents-query";
import { loadPackSummariesFor } from "@/lib/domain/pack-sync";
import { isDeliverableLate, isSignedContract } from "@/lib/domain/rules";
import {
  isPackSettlement,
  packKey,
  settlementPolicyOf,
  sumAccruedByCurrency,
  type PackProgress,
} from "@/lib/domain/settlement";
import { toInputDate } from "@/lib/format";

export type ContentRowData = {
  id: string;
  position: number;
  status: string;
  campaignId: string | null;
  clientId: string | null;
  contentDate: string | null;
  paymentDueAt: string | null;
  postUrl: string | null;
  isLate: boolean;
  costMinor: number;
  costCurrency: string;
  creatorHandle: string;
  creatorId: string;
  contractId: string;
  contractCode: string;
  contractSigned: boolean;
  pack: PackProgress | null;
  platformSubmitError: string | null;
};

export type ContentsCampaignOption = {
  id: string;
  name: string;
  clientName: string | null;
  clientId: string | null;
};

export type ContentsPageData = {
  page: number;
  total: number;
  rows: ContentRowData[];
  counts: Record<string, number>;
  lateCount: number;
  accruedByCurrency: Record<string, number>;
  selectedCreator: { id: string; handle: string } | null;
  campaigns: { id: string; name: string }[];
  campaignOptions: ContentsCampaignOption[];
  hasFilters: boolean;
};

const deliverableOrderBy = [
  { scheduledFor: "asc" as const },
  { publishedAt: "asc" as const },
  { createdAt: "asc" as const },
];

export function hasContentFilters(filters: ContentFilters): boolean {
  return Boolean(
    filters.creador ||
      filters.campana ||
      filters.estado ||
      filters.desde ||
      filters.hasta ||
      filters.retrasados ||
      filters.sinEnlace ||
      filters.errorPlataforma ||
      filters.sinFirmar
  );
}

export async function loadContentsPage(
  filters: ContentFilters
): Promise<ContentsPageData> {
  const where = buildDeliverableWhere(filters);
  const page = parsePage(filters.pagina);
  const skip = (page - 1) * CONTENTS_PAGE_SIZE;
  const liveWhere = withLiveStatus(where);
  const lateWhere = buildLateDeliverableWhere(filters);

  const [
    deliverables,
    total,
    statusGroups,
    lateCount,
    creators,
    campaigns,
    liveItems,
  ] = await Promise.all([
    prisma.deliverable.findMany({
      where,
      orderBy: deliverableOrderBy,
      skip,
      take: CONTENTS_PAGE_SIZE,
      select: {
        id: true,
        position: true,
        status: true,
        campaignId: true,
        scheduledFor: true,
        publishedAt: true,
        paymentDueAt: true,
        postUrl: true,
        platformSubmitError: true,
        contractId: true,
        contract: {
          select: {
            code: true,
            status: true,
            creatorId: true,
            clientId: true,
            costMinorPerContent: true,
            costCurrency: true,
            creator: { select: { handle: true } },
            client: {
              select: {
                settlementMode: true,
                requiresPlatformSubmit: true,
              },
            },
          },
        },
        campaign: {
          select: {
            client: {
              select: {
                settlementMode: true,
                requiresPlatformSubmit: true,
              },
            },
          },
        },
      },
    }),
    prisma.deliverable.count({ where }),
    prisma.deliverable.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.deliverable.count({ where: lateWhere }),
    prisma.creator.findMany({
      where: filters.creador ? { id: filters.creador } : undefined,
      orderBy: { handle: "asc" },
      select: { id: true, handle: true },
      take: filters.creador ? 1 : 0,
    }),
    prisma.campaign.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        clientId: true,
        client: { select: { name: true } },
      },
    }),
    liveWhere
      ? prisma.deliverable.findMany({
          where: liveWhere,
          take: filters.campana ? 4000 : 800,
          select: {
            status: true,
            campaignId: true,
            contract: {
              select: {
                creatorId: true,
                costCurrency: true,
                costMinorPerContent: true,
                client: {
                  select: {
                    settlementMode: true,
                    requiresPlatformSubmit: true,
                  },
                },
              },
            },
            campaign: {
              select: {
                client: {
                  select: {
                    settlementMode: true,
                    requiresPlatformSubmit: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const packs = await loadPackSummariesFor([
    ...deliverables.map((item) => item.campaignId),
    ...liveItems.map((item) => item.campaignId),
  ]);

  const campaignOptions = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    clientName: campaign.client?.name ?? null,
    clientId: campaign.clientId,
  }));

  const rows: ContentRowData[] = deliverables.map((item) => {
    const policy = settlementPolicyOf({
      client: item.contract.client,
      campaign: item.campaign,
    });
    const pack =
      item.campaignId && isPackSettlement(policy)
        ? (packs.get(packKey(item.campaignId, item.contract.creatorId)) ?? null)
        : null;

    return {
      id: item.id,
      position: item.position,
      status: item.status,
      campaignId: item.campaignId,
      clientId: item.contract.clientId,
      contentDate: toInputDate(item.publishedAt ?? item.scheduledFor),
      paymentDueAt: item.paymentDueAt?.toISOString() ?? null,
      postUrl: item.postUrl,
      isLate: isDeliverableLate(item),
      costMinor: item.contract.costMinorPerContent,
      costCurrency: item.contract.costCurrency,
      creatorHandle: item.contract.creator.handle,
      creatorId: item.contract.creatorId,
      contractId: item.contractId,
      contractCode: item.contract.code,
      contractSigned: isSignedContract(item.contract.status),
      pack,
      platformSubmitError: item.platformSubmitError,
    };
  });

  return {
    page,
    total,
    rows,
    counts: statusCountsFromGroup(statusGroups),
    lateCount,
    accruedByCurrency: sumAccruedByCurrency(
      liveItems.map((item) => ({
        status: item.status,
        campaignId: item.campaignId,
        creatorId: item.contract.creatorId,
        costCurrency: item.contract.costCurrency,
        costMinorPerContent: item.contract.costMinorPerContent,
        policy: settlementPolicyOf({
          client: item.contract.client,
          campaign: item.campaign,
        }),
      })),
      packs
    ),
    selectedCreator: creators[0] ?? null,
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
    })),
    campaignOptions,
    hasFilters: hasContentFilters(filters),
  };
}
