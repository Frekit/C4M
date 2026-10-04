import { prisma } from "@/lib/db";
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
  creator: {
    id: string;
    handle: string;
    country: string | null;
    profileType: string | null;
    instagramUrl: string;
  };
  others: CreatorCampaignPresence[];
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
          campaignTalents: {
            select: {
              campaignId: true,
              status: true,
              campaign: { select: { name: true, status: true } },
            },
          },
          contracts: {
            select: {
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
      creator: {
        id: row.creator.id,
        handle: row.creator.handle,
        country: row.creator.country,
        profileType: row.creator.profileType,
        instagramUrl: row.creator.instagramUrl,
      },
      others: otherCampaigns(presence, campaignId),
    };
  });
}
