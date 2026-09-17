import { prisma } from "@/lib/db";
import {
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
  SIGNATURE_STATUS,
} from "@/lib/domain/enums";
import { isLiveDeliverable } from "@/lib/domain/rules";

export type CampaignStatusCounts = Record<string, number>;

export type CampaignWorkbench = {
  id: string;
  name: string;
  status: string;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  client: {
    id: string;
    name: string;
    settlementMode: string;
    requiresPlatformSubmit: boolean;
  } | null;
  deliverableTotal: number;
  deliverableByStatus: CampaignStatusCounts;
  publishedCount: number;
  lateCount: number;
  missingLinkCount: number;
  platformErrorCount: number;
  paidCount: number;
  creatorCount: number;
  contractsByStatus: CampaignStatusCounts;
  unsignedCount: number;
  expiredSignatureCount: number;
};

export async function loadCampaignSummaries() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { client: true },
  });

  if (campaigns.length === 0) return [];

  const ids = campaigns.map((campaign) => campaign.id);
  const [statusGroups] = await Promise.all([
    prisma.deliverable.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const byCampaign = new Map<
    string,
    { total: number; published: number; byStatus: CampaignStatusCounts }
  >();

  for (const group of statusGroups) {
    if (!group.campaignId) continue;
    const current = byCampaign.get(group.campaignId) ?? {
      total: 0,
      published: 0,
      byStatus: {},
    };
    current.total += group._count._all;
    current.byStatus[group.status] = group._count._all;
    if (isLiveDeliverable(group.status)) {
      current.published += group._count._all;
    }
    byCampaign.set(group.campaignId, current);
  }

  return campaigns.map((campaign) => {
    const stats = byCampaign.get(campaign.id);
    return {
      campaign,
      total: stats?.total ?? 0,
      published: stats?.published ?? 0,
    };
  });
}

export async function loadCampaignWorkbench(
  id: string
): Promise<CampaignWorkbench | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { client: true },
  });

  if (!campaign) return null;

  const inCampaign = { campaignId: id };
  const now = new Date();

  const [
    deliverableTotal,
    statusGroups,
    lateCount,
    missingLinkCount,
    platformErrorCount,
    paidCount,
    contracts,
    expiredSignatureCount,
  ] = await Promise.all([
    prisma.deliverable.count({ where: inCampaign }),
    prisma.deliverable.groupBy({
      by: ["status"],
      where: inCampaign,
      _count: { _all: true },
    }),
    prisma.deliverable.count({
      where: {
        ...inCampaign,
        status: {
          notIn: [DELIVERABLE_STATUS.PUBLISHED, DELIVERABLE_STATUS.SUBMITTED],
        },
        scheduledFor: { lt: now },
      },
    }),
    prisma.deliverable.count({
      where: {
        ...inCampaign,
        status: DELIVERABLE_STATUS.PUBLISHED,
        postUrl: null,
      },
    }),
    prisma.deliverable.count({
      where: {
        ...inCampaign,
        platformSubmitError: { not: null },
      },
    }),
    prisma.deliverable.count({
      where: { ...inCampaign, paidAt: { not: null } },
    }),
    prisma.contract.findMany({
      where: { deliverables: { some: inCampaign } },
      select: { creatorId: true, status: true },
    }),
    prisma.signatureRequest.count({
      where: {
        status: {
          in: [SIGNATURE_STATUS.PENDING, SIGNATURE_STATUS.VIEWED],
        },
        expiresAt: { lt: now },
        contract: {
          status: { in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT] },
          deliverables: { some: inCampaign },
        },
      },
    }),
  ]);

  const deliverableByStatus: CampaignStatusCounts = {};
  let publishedCount = 0;
  for (const group of statusGroups) {
    deliverableByStatus[group.status] = group._count._all;
    if (isLiveDeliverable(group.status)) {
      publishedCount += group._count._all;
    }
  }

  const contractsByStatus: CampaignStatusCounts = {};
  const creatorIds = new Set<string>();
  let unsignedCount = 0;
  for (const contract of contracts) {
    contractsByStatus[contract.status] =
      (contractsByStatus[contract.status] ?? 0) + 1;
    creatorIds.add(contract.creatorId);
    if (
      contract.status === CONTRACT_STATUS.DRAFT ||
      contract.status === CONTRACT_STATUS.SENT
    ) {
      unsignedCount += 1;
    }
  }

  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    description: campaign.description,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    client: campaign.client,
    deliverableTotal,
    deliverableByStatus,
    publishedCount,
    lateCount,
    missingLinkCount,
    platformErrorCount,
    paidCount,
    creatorCount: creatorIds.size,
    contractsByStatus,
    unsignedCount,
    expiredSignatureCount,
  };
}
