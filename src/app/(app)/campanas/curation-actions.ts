"use server";

import { randomBytes } from "node:crypto";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import {
  OPEN_TALENT_STATUSES,
  quoteIsFrozen,
} from "@/lib/domain/campaign-desk";
import {
  revalidateCampaign,
  type CampaignRosterResult,
} from "./roster-actions";

export type CampaignTalkResult = {
  ok: boolean;
  error?: string;
  token?: string;
};

function clip(value: FormDataEntryValue | null, max: number) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.slice(0, max);
}

export async function setCampaignCuration(
  _prev: CampaignRosterResult | null,
  formData: FormData
): Promise<CampaignRosterResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const creatorId = String(formData.get("creatorId") ?? "");
  const stance = String(formData.get("stance") ?? "");
  if (!campaignId || !creatorId) {
    return { ok: false, error: "Falta el perfil o la campaña." };
  }
  if (stance !== "SAVED" && stance !== "DISMISSED") {
    return { ok: false, error: "Esa marca no vale." };
  }

  const open = await prisma.campaignTalent.findFirst({
    where: {
      campaignId,
      creatorId,
      status: { in: [...OPEN_TALENT_STATUSES] },
    },
    select: { id: true, status: true },
  });
  if (open && quoteIsFrozen(open.status)) {
    return {
      ok: false,
      error: "Esa línea ya está cerrada. No la saco de la mesa.",
    };
  }
  if (open) {
    await prisma.campaignTalent.delete({ where: { id: open.id } });
  }
  await prisma.campaignCuration.upsert({
    where: { campaignId_creatorId: { campaignId, creatorId } },
    create: { campaignId, creatorId, stance, createdBy: user.email },
    update: { stance, createdBy: user.email },
  });
  await recordAudit({
    entityType: "CampaignCuration",
    entityId: campaignId,
    action: stance === "SAVED" ? "CURATION_SAVED" : "CURATION_DISMISSED",
    actor: user,
    metadata: { campaignId, creatorId },
  });
  revalidateCampaign(campaignId, creatorId);
  return { ok: true };
}

export async function removeFromCampaignDesk(
  _prev: CampaignRosterResult | null,
  formData: FormData
): Promise<CampaignRosterResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const creatorId = String(formData.get("creatorId") ?? "");
  const open = await prisma.campaignTalent.findFirst({
    where: {
      campaignId,
      creatorId,
      status: { in: [...OPEN_TALENT_STATUSES] },
    },
    select: { id: true, status: true },
  });
  if (!open) return { ok: false, error: "No está en la mesa." };
  if (quoteIsFrozen(open.status)) {
    return {
      ok: false,
      error: "La línea ya está en una oleada o activa. No la quito.",
    };
  }
  await prisma.campaignTalent.delete({ where: { id: open.id } });
  await recordAudit({
    entityType: "CampaignTalent",
    entityId: open.id,
    action: "ROSTER_REMOVED",
    actor: user,
    metadata: { campaignId, creatorId },
  });
  revalidateCampaign(campaignId, creatorId);
  return { ok: true };
}

export async function saveCampaignBrief(
  _prev: CampaignTalkResult | null,
  formData: FormData
): Promise<CampaignTalkResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) return { ok: false, error: "Esa campaña no existe." };

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      briefObjective: clip(formData.get("briefObjective"), 2000),
      briefAudience: clip(formData.get("briefAudience"), 2000),
      briefNetworks: clip(formData.get("briefNetworks"), 500),
      briefFormats: clip(formData.get("briefFormats"), 500),
      briefNotes: clip(formData.get("briefNotes"), 4000),
    },
  });
  await recordAudit({
    entityType: "Campaign",
    entityId: campaignId,
    action: "BRIEF_SAVED",
    actor: user,
  });
  revalidateCampaign(campaignId);
  return { ok: true };
}

export async function ensureClientTalkLink(
  _prev: CampaignTalkResult | null,
  formData: FormData
): Promise<CampaignTalkResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, clientAccessToken: true },
  });
  if (!campaign) return { ok: false, error: "Esa campaña no existe." };
  if (campaign.clientAccessToken) {
    return { ok: true, token: campaign.clientAccessToken };
  }

  const token = randomBytes(18).toString("base64url");
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { clientAccessToken: token },
  });
  await recordAudit({
    entityType: "Campaign",
    entityId: campaignId,
    action: "CLIENT_LINK_CREATED",
    actor: user,
  });
  revalidateCampaign(campaignId);
  return { ok: true, token };
}

export async function postAgencyMessage(
  _prev: CampaignTalkResult | null,
  formData: FormData
): Promise<CampaignTalkResult> {
  const user = await requirePermission("campaigns:manage", "/campanas");
  const campaignId = String(formData.get("campaignId") ?? "");
  const body = clip(formData.get("body"), 4000);
  if (!body) return { ok: false, error: "Escribe el mensaje." };
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) return { ok: false, error: "Esa campaña no existe." };

  const visibleToClient = formData.get("visibleToClient") === "1";
  await prisma.campaignMessage.create({
    data: {
      campaignId,
      authorKind: "AGENCY",
      authorLabel: user.name || user.email,
      body,
      visibility: visibleToClient ? "SHARED" : "INTERNAL",
    },
  });
  revalidateCampaign(campaignId);
  return { ok: true };
}

export async function postClientMessage(
  _prev: CampaignTalkResult | null,
  formData: FormData
): Promise<CampaignTalkResult> {
  const token = String(formData.get("token") ?? "");
  const body = clip(formData.get("body"), 4000);
  const name = clip(formData.get("name"), 80) ?? "Cliente";
  if (!body) return { ok: false, error: "Escribe el mensaje." };
  const campaign = await prisma.campaign.findUnique({
    where: { clientAccessToken: token },
    select: { id: true },
  });
  if (!campaign) return { ok: false, error: "Este enlace no vale." };

  await prisma.campaignMessage.create({
    data: {
      campaignId: campaign.id,
      authorKind: "CLIENT",
      authorLabel: name,
      body,
      visibility: "SHARED",
    },
  });
  revalidateCampaign(campaign.id);
  return { ok: true };
}
