import { prisma } from "@/lib/db";
import {
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
} from "@/lib/domain/enums";
import { loadOpsAlerts } from "@/lib/domain/ops-alerts";
import { loadPackCampaignIds, loadPackSummaries } from "@/lib/domain/pack-sync";
import {
  settlementPolicyOf,
  sumAccruedByCurrency,
} from "@/lib/domain/settlement";

const liveContract = {
  status: { not: CONTRACT_STATUS.CANCELLED },
} as const;

const liveStatus = [
  DELIVERABLE_STATUS.PUBLISHED,
  DELIVERABLE_STATUS.SUBMITTED,
] as const;

export async function loadDashboard() {
  const packCampaignIdsPromise = loadPackCampaignIds();

  const [
    creatorCount,
    deliverableTotal,
    deliverablePublished,
    liveContracts,
    awaitingSignature,
    awaitingSignatureCount,
    packs,
    liveDeliverables,
    upcomingPayments,
    opsAlerts,
  ] = await Promise.all([
    prisma.creator.count(),
    prisma.deliverable.count({ where: { contract: liveContract } }),
    prisma.deliverable.count({
      where: {
        contract: liveContract,
        status: { in: [...liveStatus] },
      },
    }),
    prisma.contract.findMany({
      where: liveContract,
      select: {
        salePriceCentsPerContent: true,
        costUsdCentsPerContent: true,
        deliverableCount: true,
      },
    }),
    prisma.contract.findMany({
      where: {
        status: { in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT] },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        code: true,
        status: true,
        creator: { select: { handle: true } },
      },
    }),
    prisma.contract.count({
      where: { status: { in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT] } },
    }),
    loadPackSummaries(),
    prisma.deliverable.findMany({
      where: {
        contract: liveContract,
        status: { in: [...liveStatus] },
      },
      select: {
        status: true,
        campaignId: true,
        contract: {
          select: {
            creatorId: true,
            costCurrency: true,
            costMinorPerContent: true,
            client: {
              select: { settlementMode: true, requiresPlatformSubmit: true },
            },
          },
        },
        campaign: {
          select: {
            client: {
              select: { settlementMode: true, requiresPlatformSubmit: true },
            },
          },
        },
      },
    }),
    packCampaignIdsPromise.then((packCampaignIds) =>
      prisma.deliverable.findMany({
        where: {
          paymentDueAt: { not: null },
          paidAt: null,
          contract: liveContract,
          OR:
            packCampaignIds.length > 0
              ? [
                  { status: DELIVERABLE_STATUS.SUBMITTED },
                  {
                    status: DELIVERABLE_STATUS.PUBLISHED,
                    campaignId: { in: packCampaignIds },
                  },
                ]
              : [{ status: DELIVERABLE_STATUS.SUBMITTED }],
        },
        orderBy: { paymentDueAt: "asc" },
        take: 8,
        select: {
          id: true,
          position: true,
          contractId: true,
          paymentDueAt: true,
          contract: {
            select: {
              costMinorPerContent: true,
              costCurrency: true,
              creator: { select: { handle: true } },
            },
          },
        },
      })
    ),
    loadOpsAlerts(),
  ]);

  const marginUsdCents = liveContracts.reduce((total, contract) => {
    return (
      total +
      (contract.salePriceCentsPerContent - contract.costUsdCentsPerContent) *
        contract.deliverableCount
    );
  }, 0);

  const accruedByCurrency = sumAccruedByCurrency(
    liveDeliverables.map((item) => ({
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
  );

  return {
    creatorCount,
    progress: {
      published: deliverablePublished,
      total: deliverableTotal,
    },
    marginUsdCents,
    accruedByCurrency,
    awaitingSignature,
    awaitingSignatureCount,
    upcomingPayments,
    opsAlerts,
  };
}
