import "server-only";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { OPEN_TALENT_STATUSES } from "@/lib/domain/campaign-desk";
import { CAMPAIGN_TALENT_STATUS } from "@/lib/domain/enums";

// Helpers de la mesa. No viven en un archivo "use server": allí cada export
// async es un endpoint. Los llaman las acciones que ya comprobaron el permiso.
export async function revalidateCampaign(campaignId: string, creatorId?: string) {
  revalidatePath("/campanas");
  revalidatePath(`/campanas/${campaignId}`);
  revalidatePath(`/campanas/${campaignId}/planilla`);
  revalidatePath("/creators");
  if (creatorId) revalidatePath(`/creators/${creatorId}`);
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { clientAccessToken: true },
  });
  if (campaign?.clientAccessToken) {
    revalidatePath(`/hablar/${campaign.clientAccessToken}`);
  }
}

export async function placeCreatorOnCampaign(
  campaignId: string,
  creatorId: string,
  email: string
) {
  await prisma.campaignCuration.deleteMany({
    where: { campaignId, creatorId },
  });
  const open = await prisma.campaignTalent.findFirst({
    where: {
      campaignId,
      creatorId,
      status: { in: [...OPEN_TALENT_STATUSES] },
    },
    select: { id: true },
  });
  if (open) return false;

  await prisma.campaignTalent.create({
    data: {
      campaignId,
      creatorId,
      status: CAMPAIGN_TALENT_STATUS.ROSTER,
      createdBy: email,
    },
  });
  return true;
}
