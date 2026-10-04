import { prisma } from "@/lib/db";
import { TALENT_STATUS_RANK } from "@/lib/domain/campaign-desk";
import {
  CAMPAIGN_TALENT_STATUS,
  type CampaignTalentStatus,
} from "@/lib/domain/enums";

export type CreatorCampaignPresence = {
  campaignId: string;
  campaignName: string;
  campaignStatus: string;
  clientId: string | null;
  clientName: string | null;
  talentStatus: CampaignTalentStatus;
  source: "roster" | "deliverable";
};

type PresenceCampaign = {
  name: string;
  status: string;
  client: { id: string; name: string } | null;
};

export function isCampaignTalentStatus(
  value: string
): value is CampaignTalentStatus {
  return Object.values(CAMPAIGN_TALENT_STATUS).includes(
    value as CampaignTalentStatus
  );
}

function rememberClient(
  current: CreatorCampaignPresence,
  client: { id: string; name: string } | null
) {
  if (!current.clientId && client) {
    current.clientId = client.id;
    current.clientName = client.name;
  }
}

export function mergeCreatorPresence(
  roster: {
    campaignId: string;
    status: string;
    campaign: PresenceCampaign;
  }[],
  deliverableCampaigns: ({
    id: string;
  } & PresenceCampaign)[]
): CreatorCampaignPresence[] {
  const byId = new Map<string, CreatorCampaignPresence>();

  for (const row of roster) {
    if (!isCampaignTalentStatus(row.status)) continue;
    const next: CreatorCampaignPresence = {
      campaignId: row.campaignId,
      campaignName: row.campaign.name,
      campaignStatus: row.campaign.status,
      clientId: row.campaign.client?.id ?? null,
      clientName: row.campaign.client?.name ?? null,
      talentStatus: row.status,
      source: "roster",
    };
    const existing = byId.get(row.campaignId);
    if (
      !existing ||
      TALENT_STATUS_RANK[next.talentStatus] >
        TALENT_STATUS_RANK[existing.talentStatus]
    ) {
      if (existing && !next.clientId && existing.clientId) {
        next.clientId = existing.clientId;
        next.clientName = existing.clientName;
      }
      byId.set(row.campaignId, next);
    } else {
      rememberClient(existing, row.campaign.client);
    }
  }

  for (const campaign of deliverableCampaigns) {
    const existing = byId.get(campaign.id);
    if (existing) {
      rememberClient(existing, campaign.client);
      if (
        TALENT_STATUS_RANK[existing.talentStatus] <
        TALENT_STATUS_RANK[CAMPAIGN_TALENT_STATUS.ACTIVE]
      ) {
        existing.talentStatus = CAMPAIGN_TALENT_STATUS.ACTIVE;
      }
      continue;
    }
    byId.set(campaign.id, {
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      clientId: campaign.client?.id ?? null,
      clientName: campaign.client?.name ?? null,
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
        campaign: {
          select: {
            name: true,
            status: true,
            client: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.deliverable.findMany({
      where: { contract: { creatorId }, campaignId: { not: null } },
      distinct: ["campaignId"],
      select: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            client: { select: { id: true, name: true } },
          },
        },
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
