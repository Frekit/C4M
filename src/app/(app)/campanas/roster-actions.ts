"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import {
  OPEN_TALENT_STATUSES,
  canSendLineInWave,
  policyFromCampaign,
} from "@/lib/domain/campaign-desk";
import { upsertRosterCreator } from "@/lib/domain/roster-upsert";
import {
  activateTalentLine,
  applyClientTalentStatus,
  applyTalentQuote,
} from "@/lib/domain/talent-commands";
import {
  CAMPAIGN_APPROVAL,
  CAMPAIGN_TALENT_STATUS,
  PROPOSAL_STATUS,
} from "@/lib/domain/enums";
import { handlesFromPaste, TALENT_PASTE_MAX } from "@/lib/domain/talent-paste";

export type CampaignRosterResult = {
  ok: boolean;
  error?: string;
  added?: number;
  skipped?: number;
};

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

function addedMessage(added: number, skipped: number) {
  if (added === 0) {
    return { ok: false as const, error: "Esos perfiles ya están en la mesa.", added, skipped };
  }
  return { ok: true as const, added, skipped };
}

export async function addCreatorsToCampaign(
  _prev: CampaignRosterResult | null,
  formData: FormData
): Promise<CampaignRosterResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const creatorIds = [
    ...new Set(
      formData
        .getAll("creatorId")
        .map((value) => String(value))
        .filter(Boolean)
    ),
  ];

  if (!campaignId) return { ok: false, error: "Falta la campaña." };
  if (creatorIds.length === 0) {
    return { ok: false, error: "Marca al menos un perfil." };
  }
  if (creatorIds.length > TALENT_PASTE_MAX) {
    return { ok: false, error: `Como máximo ${TALENT_PASTE_MAX} perfiles por tanda.` };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) return { ok: false, error: "Esa campaña no existe." };

  let added = 0;
  let skipped = 0;
  for (const creatorId of creatorIds) {
    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      select: { id: true },
    });
    if (!creator) {
      skipped += 1;
      continue;
    }
    const placed = await placeCreatorOnCampaign(campaignId, creator.id, user.email);
    if (placed) added += 1;
    else skipped += 1;
  }

  if (added > 0) {
    await recordAudit({
      entityType: "CampaignTalent",
      entityId: campaignId,
      action: "ROSTER_ADDED",
      actor: user,
      metadata: { campaignId, added, skipped },
    });
  }

  revalidateCampaign(campaignId);
  return addedMessage(added, skipped);
}

export async function pasteTalentToCampaign(
  _prev: CampaignRosterResult | null,
  formData: FormData
): Promise<CampaignRosterResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const parsed = handlesFromPaste(String(formData.get("handles") ?? ""));

  if (!campaignId) return { ok: false, error: "Falta la campaña." };
  if (parsed.handles.length === 0) {
    return {
      ok: false,
      error: "No veo ningún Instagram. Pega handles o enlaces, uno por línea.",
    };
  }
  if (parsed.handles.length > TALENT_PASTE_MAX) {
    return { ok: false, error: `Como máximo ${TALENT_PASTE_MAX} perfiles por tanda.` };
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) return { ok: false, error: "Esa campaña no existe." };

  let added = 0;
  let skipped = parsed.invalid;
  for (const handle of parsed.handles) {
    const { creator } = await upsertRosterCreator({
      handle,
      createdBy: user.email,
    });
    const placed = await placeCreatorOnCampaign(campaignId, creator.id, user.email);
    if (placed) added += 1;
    else skipped += 1;
  }

  if (added > 0) {
    await recordAudit({
      entityType: "CampaignTalent",
      entityId: campaignId,
      action: "ROSTER_ADDED",
      actor: user,
      metadata: { campaignId, added, skipped, pasted: parsed.handles.length },
    });
  }

  revalidateCampaign(campaignId);
  return addedMessage(added, skipped);
}

export async function setCampaignTalentStatus(formData: FormData) {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const result = await applyClientTalentStatus(user, {
    talentId: String(formData.get("talentId") ?? ""),
    status: String(formData.get("status") ?? ""),
  });
  if (!result.ok) {
    throw new Error(result.error ?? "No se ha podido cambiar el estado.");
  }
  if (result.campaignId) {
    revalidateCampaign(result.campaignId, result.creatorId);
  }
}

export async function saveCampaignTalentPrices(
  _prev: CampaignRosterResult | null,
  formData: FormData
): Promise<CampaignRosterResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const result = await applyTalentQuote(user, {
    talentId: String(formData.get("talentId") ?? ""),
    saleUsd: String(formData.get("saleUsd") ?? ""),
    cost: String(formData.get("cost") ?? ""),
    currency: String(formData.get("currency") ?? "EUR"),
    deliverableCount: String(formData.get("deliverableCount") ?? ""),
    contentPlatform: String(formData.get("contentPlatform") ?? ""),
    contentFormat: String(formData.get("contentFormat") ?? ""),
  });
  if (result.ok && result.campaignId) {
    revalidateCampaign(result.campaignId, result.creatorId);
  }
  return { ok: result.ok, error: result.error };
}

export async function activateCampaignTalent(formData: FormData) {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const result = await activateTalentLine(
    user,
    String(formData.get("talentId") ?? "")
  );
  if (!result.ok) throw new Error(result.error ?? "No se ha podido activar.");
  if (result.unchanged || !result.campaignId) return;

  revalidatePath("/contratos");
  revalidatePath("/contenidos");
  revalidateCampaign(result.campaignId, result.creatorId);
}

export async function createCampaignProposal(
  _prev: CampaignRosterResult | null,
  formData: FormData
): Promise<CampaignRosterResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!campaignId) return { ok: false, error: "Falta la campaña." };
  if (title.length < 2) return { ok: false, error: "Ponle un nombre a la oleada." };

  await prisma.campaignProposal.create({
    data: {
      campaignId,
      title,
      status: PROPOSAL_STATUS.DRAFT,
      createdBy: user.email,
    },
  });

  await recordAudit({
    entityType: "CampaignProposal",
    entityId: campaignId,
    action: "CREATED",
    actor: user,
    metadata: { title },
  });

  revalidateCampaign(campaignId);
  return { ok: true };
}

export async function addTalentToProposal(formData: FormData) {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const talentId = String(formData.get("talentId") ?? "");
  const proposalId = String(formData.get("proposalId") ?? "");
  if (!talentId || !proposalId) throw new Error("Falta la oleada o la línea.");

  const [talent, proposal] = await Promise.all([
    prisma.campaignTalent.findUnique({ where: { id: talentId } }),
    prisma.campaignProposal.findUnique({ where: { id: proposalId } }),
  ]);
  if (!talent || !proposal || talent.campaignId !== proposal.campaignId) {
    throw new Error("Esa línea no es de esta oleada.");
  }
  if (proposal.status !== PROPOSAL_STATUS.DRAFT) {
    throw new Error("Esa oleada ya se envió.");
  }
  if (!canSendLineInWave(talent)) {
    throw new Error("La línea tiene que estar lista (piezas y precios).");
  }
  if (talent.proposalId && talent.proposalId !== proposalId) {
    const currentWave = await prisma.campaignProposal.findUnique({
      where: { id: talent.proposalId },
    });
    if (currentWave && currentWave.status !== PROPOSAL_STATUS.DRAFT) {
      throw new Error("Ese perfil ya está en una oleada enviada.");
    }
  }

  await prisma.campaignTalent.update({
    where: { id: talentId },
    data: { proposalId },
  });

  await recordAudit({
    entityType: "CampaignProposal",
    entityId: proposalId,
    action: "LINE_ADDED",
    actor: user,
    metadata: { talentId },
  });

  revalidateCampaign(talent.campaignId, talent.creatorId);
}

export async function sendCampaignProposal(formData: FormData) {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const proposalId = String(formData.get("proposalId") ?? "");
  const proposal = await prisma.campaignProposal.findUnique({
    where: { id: proposalId },
    include: { campaign: true, talents: true },
  });
  if (!proposal) throw new Error("Esa oleada no existe.");
  if (proposal.status !== PROPOSAL_STATUS.DRAFT) {
    throw new Error("Esa oleada ya no está en borrador.");
  }
  if (proposal.talents.length === 0) {
    throw new Error("Mete al menos un perfil listo.");
  }
  const incomplete = proposal.talents.find((talent) => !canSendLineInWave(talent));
  if (incomplete) {
    throw new Error("Hay perfiles sin piezas o precios. Complétalos antes de enviar.");
  }

  const policy = policyFromCampaign(proposal.campaign);
  if (policy.approvalMode !== CAMPAIGN_APPROVAL.CLIENT_APPROVES) {
    throw new Error("Esta campaña es interna: no se envía al cliente.");
  }

  await prisma.$transaction([
    prisma.campaignProposal.update({
      where: { id: proposalId },
      data: { status: PROPOSAL_STATUS.SENT, sentAt: new Date() },
    }),
    prisma.campaignTalent.updateMany({
      where: {
        proposalId,
        status: {
          in: [CAMPAIGN_TALENT_STATUS.READY, CAMPAIGN_TALENT_STATUS.ROSTER],
        },
      },
      data: { status: CAMPAIGN_TALENT_STATUS.PROPOSED },
    }),
  ]);

  await recordAudit({
    entityType: "CampaignProposal",
    entityId: proposalId,
    action: "SENT",
    actor: user,
    metadata: { count: proposal.talents.length },
  });

  revalidateCampaign(proposal.campaignId);
}
