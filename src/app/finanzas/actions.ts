"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { DELIVERABLE_STATUS } from "@/lib/domain/enums";
import {
  assertCanClearPlatformError,
  assertCanMarkPaid,
  assertCanMarkPlatformError,
  assertCanSubmitToPlatform,
  assertFoundAll,
  assertIdsSelected,
  paidPolicyOf,
  parsePlatformErrorReason,
  parseSelectedIds,
  platformFlagOf,
} from "@/lib/domain/finance-commands";
import { summarizePacks } from "@/lib/domain/settlement";

export type FinanceActionResult = {
  ok: boolean;
  error?: string;
  count?: number;
};

function revalidateFinance() {
  revalidatePath("/finanzas");
  revalidatePath("/contenidos");
  revalidatePath("/contratos");
  revalidatePath("/");
}

export async function markClientSubmitted(
  _prev: FinanceActionResult | null,
  formData: FormData
): Promise<FinanceActionResult> {
  const user = await requirePermission("finance:manage", "/finanzas");
  const ids = parseSelectedIds(formData);
  const selected = assertIdsSelected(ids);
  if (!selected.ok) return selected;

  const items = await prisma.deliverable.findMany({
    where: { id: { in: ids } },
    include: {
      contract: true,
      campaign: { include: { client: true } },
    },
  });

  const found = assertFoundAll(items.length, ids.length);
  if (!found.ok) return found;

  const allowed = assertCanSubmitToPlatform(
    items.map((item) => ({
      status: item.status,
      postUrl: item.postUrl,
      requiresPlatformSubmit: platformFlagOf(item),
      platformSubmitError: item.platformSubmitError,
    }))
  );
  if (!allowed.ok) return allowed;

  const now = new Date();

  await prisma.deliverable.updateMany({
    where: { id: { in: ids } },
    data: {
      status: DELIVERABLE_STATUS.SUBMITTED,
      clientSubmittedAt: now,
      platformSubmitError: null,
      platformSubmitErrorAt: null,
    },
  });

  await recordAudit({
    entityType: "Deliverable",
    entityId: ids.join(","),
    action: "SUBMITTED",
    actor: user,
    metadata: { count: ids.length },
  });

  revalidateFinance();

  return { ok: true, count: ids.length };
}

export async function markPlatformSubmitError(
  _prev: FinanceActionResult | null,
  formData: FormData
): Promise<FinanceActionResult> {
  const user = await requirePermission("finance:manage", "/finanzas");
  const ids = parseSelectedIds(formData);
  const selected = assertIdsSelected(ids);
  if (!selected.ok) return selected;

  const reason = parsePlatformErrorReason(formData.get("reason"));
  if (!reason.ok) return reason;

  const items = await prisma.deliverable.findMany({
    where: { id: { in: ids } },
    include: {
      contract: true,
      campaign: { include: { client: true } },
    },
  });

  const found = assertFoundAll(items.length, ids.length);
  if (!found.ok) return found;

  const allowed = assertCanMarkPlatformError(
    items.map((item) => ({
      status: item.status,
      postUrl: item.postUrl,
      requiresPlatformSubmit: platformFlagOf(item),
      platformSubmitError: item.platformSubmitError,
    }))
  );
  if (!allowed.ok) return allowed;

  const now = new Date();

  await prisma.deliverable.updateMany({
    where: { id: { in: ids } },
    data: {
      platformSubmitError: reason.reason,
      platformSubmitErrorAt: now,
    },
  });

  await recordAudit({
    entityType: "Deliverable",
    entityId: ids.join(","),
    action: "PLATFORM_SUBMIT_ERROR",
    actor: user,
    metadata: { count: ids.length, reason: reason.reason },
  });

  revalidateFinance();

  return { ok: true, count: ids.length };
}

export async function clearPlatformSubmitError(
  _prev: FinanceActionResult | null,
  formData: FormData
): Promise<FinanceActionResult> {
  const user = await requirePermission("finance:manage", "/finanzas");
  const ids = parseSelectedIds(formData);
  const selected = assertIdsSelected(ids);
  if (!selected.ok) return selected;

  const items = await prisma.deliverable.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      status: true,
      postUrl: true,
      platformSubmitError: true,
    },
  });

  const found = assertFoundAll(items.length, ids.length);
  if (!found.ok) return found;

  const allowed = assertCanClearPlatformError(
    items.map((item) => ({
      status: item.status,
      postUrl: item.postUrl,
      requiresPlatformSubmit: true,
      platformSubmitError: item.platformSubmitError,
    }))
  );
  if (!allowed.ok) return allowed;

  await prisma.deliverable.updateMany({
    where: { id: { in: ids } },
    data: {
      platformSubmitError: null,
      platformSubmitErrorAt: null,
    },
  });

  await recordAudit({
    entityType: "Deliverable",
    entityId: ids.join(","),
    action: "PLATFORM_SUBMIT_RETRY",
    actor: user,
    metadata: { count: ids.length },
  });

  revalidateFinance();

  return { ok: true, count: ids.length };
}

export async function markPaid(
  _prev: FinanceActionResult | null,
  formData: FormData
): Promise<FinanceActionResult> {
  const user = await requirePermission("finance:manage", "/finanzas");
  const ids = parseSelectedIds(formData);
  const selected = assertIdsSelected(ids);
  if (!selected.ok) return selected;

  const items = await prisma.deliverable.findMany({
    where: { id: { in: ids } },
    include: {
      contract: { include: { client: true } },
      campaign: { include: { client: true } },
    },
  });

  const found = assertFoundAll(items.length, ids.length);
  if (!found.ok) return found;

  const campaignIds = [
    ...new Set(
      items
        .map((item) => item.campaignId)
        .filter((campaignId): campaignId is string => Boolean(campaignId))
    ),
  ];

  const packCompleteByKey = new Map<string, boolean>();

  if (campaignIds.length > 0) {
    const siblings = await prisma.deliverable.findMany({
      where: { campaignId: { in: campaignIds } },
      select: {
        status: true,
        campaignId: true,
        contract: { select: { creatorId: true } },
      },
    });
    const packs = summarizePacks(
      siblings.flatMap((item) => {
        if (!item.campaignId) return [];
        return [
          {
            campaignId: item.campaignId,
            creatorId: item.contract.creatorId,
            status: item.status,
          },
        ];
      })
    );
    for (const [key, progress] of packs) {
      packCompleteByKey.set(key, progress.isComplete);
    }
  }

  const allowed = assertCanMarkPaid(
    items.map((item) => ({
      paidAt: item.paidAt,
      contractStatus: item.contract.status,
      status: item.status,
      campaignId: item.campaignId,
      creatorId: item.contract.creatorId,
      policy: paidPolicyOf(item),
    })),
    packCompleteByKey
  );
  if (!allowed.ok) return allowed;

  const now = new Date();

  await prisma.deliverable.updateMany({
    where: { id: { in: ids } },
    data: { paidAt: now },
  });

  await recordAudit({
    entityType: "Deliverable",
    entityId: ids.join(","),
    action: "PAID",
    actor: user,
    metadata: { count: ids.length },
  });

  revalidateFinance();

  return { ok: true, count: ids.length };
}
