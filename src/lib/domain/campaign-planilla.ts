import { prisma } from "@/lib/db";
import { convertToUsdCents } from "@/lib/money";
import {
  CAMPAIGN_TALENT_STATUS,
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
} from "@/lib/domain/enums";

export type PlanillaRow = {
  id: string;
  creatorId: string;
  handle: string;
  name: string | null;
  platform: string | null;
  views: number | null;
  viewsAt: string | null;
  count: number | null;
  format: string | null;
  costMinor: number | null;
  currency: string;
  saleCents: number | null;
  margin: number | null;
  status: string;
  frozen: boolean;
  contractCode: string | null;
  contractId: string | null;
  contractStatus: string | null;
  signatureStatus: string | null;
};

export async function loadTalentPlanilla(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      name: true,
      status: true,
      startsAt: true,
      endsAt: true,
      client: { select: { id: true, name: true } },
    },
  });
  if (!campaign) return null;

  const talents = await prisma.campaignTalent.findMany({
    where: { campaignId },
    orderBy: { createdAt: "asc" },
    include: {
      creator: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          igMedianViews: true,
          igMedianViewsAt: true,
        },
      },
    },
  });

  const creatorIds = talents.map((row) => row.creatorId);
  const contracts = campaign.client
    ? await prisma.contract.findMany({
        where: {
          creatorId: { in: creatorIds },
          clientId: campaign.client.id,
          status: { not: CONTRACT_STATUS.CANCELLED },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          code: true,
          status: true,
          creatorId: true,
          fxUnitsPerUsd: true,
          signatureRequests: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
        },
      })
    : [];

  const published = await prisma.deliverable.count({
    where: {
      campaignId,
      status: { in: [DELIVERABLE_STATUS.PUBLISHED, DELIVERABLE_STATUS.SUBMITTED] },
    },
  });

  const currencies = [
    ...new Set(talents.map((row) => row.costCurrency).filter(Boolean)),
  ] as string[];
  const rates = await Promise.all(
    currencies.map(async (currency) => {
      const rate = await prisma.fxRate.findFirst({
        where: { currency },
        orderBy: { date: "desc" },
        select: { unitsPerUsd: true },
      });
      return [currency, rate?.unitsPerUsd ?? null] as const;
    })
  );
  const fx = new Map(rates);

  const byCreator = new Map<string, (typeof contracts)[number]>();
  for (const contract of contracts) {
    if (!byCreator.has(contract.creatorId)) byCreator.set(contract.creatorId, contract);
  }

  const rows: PlanillaRow[] = talents.map((row) => {
    const contract = byCreator.get(row.creatorId) ?? null;
    const units = contract?.fxUnitsPerUsd ?? fx.get(row.costCurrency ?? "") ?? null;
    let margin: number | null = null;
    if (row.salePriceCentsPerContent && row.costMinorPerContent && units && units > 0) {
      const costUsd = convertToUsdCents(row.costMinorPerContent, row.costCurrency ?? "EUR", units);
      margin = (row.salePriceCentsPerContent - costUsd) / row.salePriceCentsPerContent;
    }
    const frozen = row.status !== CAMPAIGN_TALENT_STATUS.ROSTER && row.status !== CAMPAIGN_TALENT_STATUS.READY;
    return {
      id: row.id,
      creatorId: row.creatorId,
      handle: row.creator.handle,
      name: row.creator.displayName,
      platform: row.contentPlatform,
      views: row.creator.igMedianViews,
      viewsAt: row.creator.igMedianViewsAt?.toISOString() ?? null,
      count: row.deliverableCount,
      format: row.contentFormat,
      costMinor: row.costMinorPerContent,
      currency: row.costCurrency ?? "EUR",
      saleCents: row.salePriceCentsPerContent,
      margin,
      status: row.status,
      frozen,
      contractCode: contract?.code ?? null,
      contractId: contract?.id ?? null,
      contractStatus: contract?.status ?? null,
      signatureStatus: contract?.signatureRequests[0]?.status ?? null,
    };
  });

  return { campaign, rows, published };
}
