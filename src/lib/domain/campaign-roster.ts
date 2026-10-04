import { prisma } from "@/lib/db";
import {
  committedSaleCents,
  policyFromCampaign,
  type CampaignPolicy,
} from "@/lib/domain/campaign-desk";
import {
  mergeCreatorPresence,
  otherCampaigns,
  type CreatorCampaignPresence,
} from "@/lib/domain/campaign-talent";
import { formatMoney } from "@/lib/money";

export type CampaignRosterRow = {
  id: string;
  status: string;
  saleLabel: string | null;
  costLabel: string | null;
  salePriceCentsPerContent: number | null;
  costMinorPerContent: number | null;
  costCurrency: string | null;
  deliverableCount: number | null;
  proposalId: string | null;
  contract: { id: string; code: string } | null;
  creator: {
    id: string;
    handle: string;
    country: string | null;
    profileType: string | null;
    instagramUrl: string;
    defaultCostMinor: number | null;
    defaultCostCurrency: string | null;
  };
  others: CreatorCampaignPresence[];
};

export type CampaignProposalRow = {
  id: string;
  title: string;
  status: string;
  sentAt: Date | null;
  talentIds: string[];
};

export async function loadCampaignRoster(
  campaignId: string
): Promise<CampaignRosterRow[]> {
  const rows = await prisma.campaignTalent.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    include: {
      creator: {
        select: {
          id: true,
          handle: true,
          country: true,
          profileType: true,
          instagramUrl: true,
          defaultCostMinor: true,
          defaultCostCurrency: true,
          campaignTalents: {
            select: {
              campaignId: true,
              status: true,
              campaign: { select: { name: true, status: true } },
            },
          },
          contracts: {
            where: { deliverables: { some: { campaignId } } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              code: true,
              deliverables: {
                where: { campaignId: { not: null } },
                select: {
                  campaign: { select: { id: true, name: true, status: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const presence = mergeCreatorPresence(
      row.creator.campaignTalents,
      row.creator.contracts.flatMap((contract) =>
        contract.deliverables
          .map((item) => item.campaign)
          .filter((campaign): campaign is NonNullable<typeof campaign> =>
            Boolean(campaign)
          )
      )
    );

    return {
      id: row.id,
      status: row.status,
      saleLabel:
        row.salePriceCentsPerContent != null
          ? formatMoney(row.salePriceCentsPerContent, "USD")
          : null,
      costLabel:
        row.costMinorPerContent != null && row.costCurrency
          ? formatMoney(row.costMinorPerContent, row.costCurrency)
          : null,
      salePriceCentsPerContent: row.salePriceCentsPerContent,
      costMinorPerContent: row.costMinorPerContent,
      costCurrency: row.costCurrency,
      deliverableCount: row.deliverableCount,
      proposalId: row.proposalId,
      contract: row.creator.contracts[0]
        ? {
            id: row.creator.contracts[0].id,
            code: row.creator.contracts[0].code,
          }
        : null,
      creator: {
        id: row.creator.id,
        handle: row.creator.handle,
        country: row.creator.country,
        profileType: row.creator.profileType,
        instagramUrl: row.creator.instagramUrl,
        defaultCostMinor: row.creator.defaultCostMinor,
        defaultCostCurrency: row.creator.defaultCostCurrency,
      },
      others: otherCampaigns(presence, campaignId),
    };
  });
}

export async function loadCampaignProposals(campaignId: string) {
  const rows = await prisma.campaignProposal.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    include: { talents: { select: { id: true } } },
  });
  return rows.map<CampaignProposalRow>((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    sentAt: row.sentAt,
    talentIds: row.talents.map((talent) => talent.id),
  }));
}

export function deskBudget(policy: CampaignPolicy, rows: CampaignRosterRow[]) {
  const committed = committedSaleCents(rows);
  return {
    policy,
    committed,
    remaining:
      policy.budgetSaleCents != null
        ? policy.budgetSaleCents - committed
        : null,
  };
}

export { policyFromCampaign };
