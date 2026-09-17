import { cache } from "react";

import { prisma } from "@/lib/db";
import {
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
  SIGNATURE_STATUS,
} from "@/lib/domain/enums";
import {
  groupPackQueue,
  groupPayoutQueue,
  payableFromQueues,
  splitPlatformQueue,
  type PayeeSnapshot,
  type PackQueueSource,
  type PlatformQueueSource,
  type PayoutQueueSource,
} from "@/lib/domain/finance-queues";
import { loadPackCampaignIds } from "@/lib/domain/pack-sync";

const liveContract = {
  status: { not: CONTRACT_STATUS.CANCELLED },
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

export async function loadFinanceQueues() {
  const [platformCampaignIds, packCampaignIds] = await Promise.all([
    loadPlatformCampaignIds(),
    loadPackCampaignIds(),
  ]);

  const [platformRows, packRows, submittedRows, recentPaidRows] =
    await Promise.all([
    platformCampaignIds.length === 0
      ? Promise.resolve([])
      : prisma.deliverable.findMany({
          where: {
            status: DELIVERABLE_STATUS.PUBLISHED,
            paidAt: null,
            campaignId: { in: platformCampaignIds },
            contract: liveContract,
          },
          orderBy: [{ publishedAt: "asc" }, { position: "asc" }],
          select: {
            id: true,
            position: true,
            postUrl: true,
            publishedAt: true,
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
                costMinorPerContent: true,
                costCurrency: true,
                creator: { select: { handle: true } },
              },
            },
          },
        }),
    packCampaignIds.length === 0
      ? Promise.resolve([])
      : prisma.deliverable.findMany({
          where: {
            campaignId: { in: packCampaignIds },
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
      },
      orderBy: [{ paymentDueAt: "asc" }, { position: "asc" }],
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
  ]);

  const platformItems: PlatformQueueSource[] = platformRows.map((item) => ({
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
  }));

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

  const platform = splitPlatformQueue(platformItems);
  const packGroups = groupPackQueue(packItems);
  const openPackGroups = packGroups.filter((group) => !group.allPaid);
  const payableItems = payableFromQueues(
    submittedItems,
    packItems,
    packGroups
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

  return {
    platformGroups: platform.groups,
    missingLink: platform.missingLink,
    readyToUploadCount: platform.readyCount,
    packGroups: openPackGroups,
    readyPacks: openPackGroups.filter((group) => group.isComplete).length,
    payoutGroups: groupPayoutQueue(payableItems, payeeByContractId),
    payableCount: payableItems.length,
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
