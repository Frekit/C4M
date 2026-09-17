import { cache } from "react";

import { prisma } from "@/lib/db";
import { CONTRACT_STATUS, SETTLEMENT_MODE } from "@/lib/domain/enums";
import {
  packPaymentDueAt,
  summarizePacks,
  type PackProgress,
} from "@/lib/domain/settlement";

export async function syncPackSettlement(input: {
  campaignId: string | null;
  creatorId: string;
}) {
  if (!input.campaignId) return;

  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    include: { client: true },
  });

  if (campaign?.client?.settlementMode !== SETTLEMENT_MODE.PACK) return;

  const items = await prisma.deliverable.findMany({
    where: {
      campaignId: input.campaignId,
      contract: {
        creatorId: input.creatorId,
        status: { not: CONTRACT_STATUS.CANCELLED },
      },
    },
    include: { contract: true },
  });

  const dueByTerm = new Map<number, Date | null>();

  await Promise.all(
    items.map((item) => {
      let paymentDueAt = dueByTerm.get(item.contract.paymentTermDays);
      if (paymentDueAt === undefined) {
        paymentDueAt = packPaymentDueAt(items, item.contract.paymentTermDays);
        dueByTerm.set(item.contract.paymentTermDays, paymentDueAt);
      }

      if (
        (item.paymentDueAt?.toISOString() ?? null) ===
        (paymentDueAt?.toISOString() ?? null)
      ) {
        return Promise.resolve();
      }

      return prisma.deliverable.update({
        where: { id: item.id },
        data: { paymentDueAt },
      });
    })
  );
}

export const loadPackCampaignIds = cache(async () => {
  const clients = await prisma.client.findMany({
    where: { settlementMode: SETTLEMENT_MODE.PACK },
    select: { id: true },
  });

  if (clients.length === 0) return [] as string[];

  const campaigns = await prisma.campaign.findMany({
    where: { clientId: { in: clients.map((client) => client.id) } },
    select: { id: true },
  });

  return campaigns.map((campaign) => campaign.id);
});

export async function loadPackSummariesFor(
  campaignIds: readonly (string | null | undefined)[]
): Promise<Map<string, PackProgress>> {
  const unique = [
    ...new Set(
      campaignIds.filter((id): id is string => Boolean(id && id.length > 0))
    ),
  ];
  if (unique.length === 0) return new Map();

  const packCampaignIds = await loadPackCampaignIds();
  if (packCampaignIds.length === 0) return new Map();

  const packSet = new Set(packCampaignIds);
  const relevant = unique.filter((id) => packSet.has(id));
  if (relevant.length === 0) return new Map();

  const items = await prisma.deliverable.findMany({
    where: {
      campaignId: { in: relevant },
      contract: { status: { not: CONTRACT_STATUS.CANCELLED } },
    },
    select: {
      status: true,
      campaignId: true,
      contract: { select: { creatorId: true } },
    },
  });

  return summarizePacks(
    items.map((item) => ({
      campaignId: item.campaignId,
      creatorId: item.contract.creatorId,
      status: item.status,
    }))
  );
}

export const loadPackSummaries = cache(async () => {
  const campaignIds = await loadPackCampaignIds();
  return loadPackSummariesFor(campaignIds);
});
