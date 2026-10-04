import { prisma } from "@/lib/db";
import {
  CAMPAIGN_TALENT_STATUS,
  type CampaignTalentStatus,
} from "@/lib/domain/enums";

export type CreatorCampaignPresence = {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  talentStatus: CampaignTalentStatus;
  source: "roster" | "deliverable";
};

export function isCampaignTalentStatus(
  value: string
): value is CampaignTalentStatus {
  return Object.values(CAMPAIGN_TALENT_STATUS).includes(
    value as CampaignTalentStatus
  );
}

export function mergeCreatorPresence(
  roster: {
    campaignId: string;
    status: string;
    campaign: { name: string; status: string };
  }[],
  deliverableCampaigns: {
    id: string;
    name: string;
    status: string;
  }[]
): CreatorCampaignPresence[] {
  const byId = new Map<string, CreatorCampaignPresence>();

  for (const row of roster) {
    if (!isCampaignTalentStatus(row.status)) continue;
    byId.set(row.campaignId, {
      campaignId: row.campaignId,
      campaignName: row.campaign.name,
      campaignStatus: row.campaign.status,
      talentStatus: row.status,
      source: "roster",
    });
  }

  for (const campaign of deliverableCampaigns) {
    const existing = byId.get(campaign.id);
    if (existing) {
      if (existing.talentStatus === CAMPAIGN_TALENT_STATUS.ROSTER) {
        existing.talentStatus = CAMPAIGN_TALENT_STATUS.ACTIVE;
      }
      continue;
    }
    byId.set(campaign.id, {
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      talentStatus: CAMPAIGN_TALENT_STATUS.ACTIVE,
      source: "deliverable",
    });
  }

  return [...byId.values()].sort((left, right) =>
    left.campaignName.localeCompare(right.campaignName, "es")
  );
}

export async function loadCreatorPresence(creatorId: string) {
  const [talents, deliverables] = await Promise.all([
    prisma.campaignTalent.findMany({
      where: { creatorId },
      select: {
        campaignId: true,
        status: true,
        campaign: { select: { name: true, status: true } },
      },
    }),
    prisma.deliverable.findMany({
      where: { contract: { creatorId }, campaignId: { not: null } },
      distinct: ["campaignId"],
      select: {
        campaign: { select: { id: true, name: true, status: true } },
      },
    }),
  ]);

  return mergeCreatorPresence(
    talents,
    deliverables
      .map((row) => row.campaign)
      .filter((campaign): campaign is NonNullable<typeof campaign> =>
        Boolean(campaign)
      )
  );
}

export function otherCampaigns(
  presence: CreatorCampaignPresence[],
  campaignId: string
) {
  return presence.filter((item) => item.campaignId !== campaignId);
}
