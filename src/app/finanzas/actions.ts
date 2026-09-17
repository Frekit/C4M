"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { DELIVERABLE_STATUS, FINANCE_MAX_IDS } from "@/lib/domain/enums";
import { listPlatformReadyIds } from "@/lib/domain/finance";
import {
  assertBatchSize,
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
import { paidAuditMetadata } from "@/lib/domain/creator-payments";
import { summarizePacks } from "@/lib/domain/settlement";

export type FinanceActionResult = {
  ok: boolean;
  error?: string;
  count?: number;
};

function revalidateFinance(creatorIds: string[] = []) {
  revalidatePath("/finanzas");
  revalidatePath("/contenidos");
  revalidatePath("/contratos");
  revalidatePath("/creators");
  revalidatePath("/auditoria");
  revalidatePath("/");
  for (const creatorId of [...new Set(creatorIds)]) {
    revalidatePath(`/creators/${creatorId}`);
  }
}

function parseBatchIds(formData: FormData) {
  const ids = parseSelectedIds(formData);
  const selected = assertIdsSelected(ids);
  if (!selected.ok) return selected;
  const sized = assertBatchSize(ids);
  if (!sized.ok) return sized;
  return { ok: true as const, ids };
}

export async function markClientSubmitted(
  _prev: FinanceActionResult | null,
  formData: FormData
): Promise<FinanceActionResult> {
  const user = await requirePermission("finance:manage", "/finanzas");
  const parsed = parseBatchIds(formData);
  if (!parsed.ok) return parsed;
  const ids = parsed.ids;

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
  const parsed = parseBatchIds(formData);
  if (!parsed.ok) return parsed;
  const ids = parsed.ids;
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
  const parsed = parseBatchIds(formData);
  if (!parsed.ok) return parsed;
  const ids = parsed.ids;

  const items = await prisma.deliverable.findMany({
    where: { id: { in: ids } },
    include: {
      contract: { include: { client: true, creator: true } },
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
  const actorEmail = user.email;

  await prisma.$transaction(
    items.map((item) =>
      prisma.deliverable.update({
        where: { id: item.id },
        data: {
          paidAt: now,
          paidByEmail: actorEmail,
          paidMinor: item.contract.costMinorPerContent,
          paidCurrency: item.contract.costCurrency,
        },
      })
    )
  );

  await recordAudit({
    entityType: "Deliverable",
    entityId: ids.join(","),
    action: "MARKED_PAID",
    actor: user,
    metadata: paidAuditMetadata({
      paidAt: now,
      items: items.map((item) => ({
        id: item.id,
        position: item.position,
        creatorId: item.contract.creatorId,
        creatorHandle: item.contract.creator.handle,
        contractId: item.contractId,
        contractCode: item.contract.code,
        campaignId: item.campaignId,
        amountMinor: item.contract.costMinorPerContent,
        currency: item.contract.costCurrency,
      })),
    }),
  });

  revalidateFinance(items.map((item) => item.contract.creatorId));

  return { ok: true, count: ids.length };
}

export async function markReadyMatching(
  _prev: FinanceActionResult | null,
  formData: FormData
): Promise<FinanceActionResult> {
  const campaignId = String(formData.get("campaignId") ?? "");
  if (!campaignId) {
    return { ok: false, error: "Elige una campaña." };
  }

  const ids = await listPlatformReadyIds([campaignId], FINANCE_MAX_IDS);
  if (ids.length === 0) {
    return { ok: false, error: "No hay contenidos listos en esta campaña." };
  }

  const fake = new FormData();
  for (const id of ids) fake.append("deliverableIds", id);
  return markClientSubmitted(null, fake);
}
