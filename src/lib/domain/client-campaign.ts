import { prisma } from "@/lib/db";

export async function campaignForClient(
  campaignId: string | null | undefined,
  clientId: string | null
): Promise<
  | { ok: true; campaignId: string | null }
  | { ok: false; error: string }
> {
  const id = campaignId?.trim() || null;
  if (!id) return { ok: true, campaignId: null };

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return { ok: false, error: "Esa campaña no existe." };
  }

  if (clientId && campaign.clientId && campaign.clientId !== clientId) {
    return {
      ok: false,
      error: "Esa campaña es de otro cliente. El contrato va con un solo cliente.",
    };
  }

  return { ok: true, campaignId: campaign.id };
}
