"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { costPerContentUsdCents } from "@/lib/domain/contract-math";
import { createContract, markParentRenewed } from "@/lib/domain/contracts";
import {
  CONTRACT_KIND,
  CONTRACT_STATUS,
  SIGNATURE_STATUS,
  type ContractKind,
} from "@/lib/domain/enums";
import { resolveFxRate, upsertFxRate } from "@/lib/domain/fx";
import {
  canDeleteContract,
  countPublished,
  isAnnexAllowed,
} from "@/lib/domain/rules";
import {
  fieldErrorsFrom,
  renewalSchema,
  sendSignatureSchema,
} from "@/lib/domain/validation";
import { parseAmountToMinorUnits } from "@/lib/money";

export type ContractActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  signatureUrl?: string;
};

export async function sendToSignature(
  _prev: ContractActionResult | null,
  formData: FormData
): Promise<ContractActionResult> {
  const user = await requirePermission("signature:send", "/contratos");

  const parsed = sendSignatureSchema.safeParse({
    contractId: formData.get("contractId"),
    recipientEmail: formData.get("recipientEmail"),
    recipientKind: formData.get("recipientKind"),
    expiresInDays: formData.get("expiresInDays") ?? 14,
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { contractId, recipientEmail, recipientKind, expiresInDays } =
    parsed.data;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { signatureRequests: true },
  });

  if (!contract) {
    return { ok: false, error: "El contrato no existe." };
  }

  if (contract.status === CONTRACT_STATUS.CANCELLED) {
    return { ok: false, error: "Un contrato cancelado no se puede enviar a firma." };
  }

  if (
    contract.signatureRequests.some(
      (request) => request.status === SIGNATURE_STATUS.SIGNED
    )
  ) {
    return { ok: false, error: "Este contrato ya está firmado." };
  }

  // Solo puede haber un enlace vivo a la vez.
  await prisma.signatureRequest.updateMany({
    where: {
      contractId,
      status: { in: [SIGNATURE_STATUS.PENDING, SIGNATURE_STATUS.VIEWED] },
    },
    data: { status: SIGNATURE_STATUS.REVOKED },
  });

  const token = randomBytes(32).toString("base64url");

  const request = await prisma.signatureRequest.create({
    data: {
      contractId,
      token,
      recipientEmail,
      recipientKind,
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
      sentAt: new Date(),
      createdBy: user.email,
    },
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: CONTRACT_STATUS.SENT },
  });

  await recordAudit({
    entityType: "Contract",
    entityId: contractId,
    action: "SIGNATURE_SENT",
    actor: user,
    metadata: { recipientEmail, recipientKind, requestId: request.id },
  });

  revalidatePath("/");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${contractId}`);

  return { ok: true, signatureUrl: `/firmar/${token}` };
}

export async function revokeSignature(formData: FormData) {
  const user = await requirePermission("signature:send", "/contratos");
  const requestId = String(formData.get("requestId") ?? "");

  const request = await prisma.signatureRequest.findUnique({
    where: { id: requestId },
  });

  if (!request || request.status === SIGNATURE_STATUS.SIGNED) return;

  await prisma.signatureRequest.update({
    where: { id: requestId },
    data: { status: SIGNATURE_STATUS.REVOKED },
  });

  const stillPending = await prisma.signatureRequest.count({
    where: {
      contractId: request.contractId,
      status: { in: [SIGNATURE_STATUS.PENDING, SIGNATURE_STATUS.VIEWED] },
    },
  });

  if (stillPending === 0) {
    await prisma.contract.update({
      where: { id: request.contractId },
      data: { status: CONTRACT_STATUS.DRAFT },
    });
  }

  await recordAudit({
    entityType: "Contract",
    entityId: request.contractId,
    action: "SIGNATURE_REVOKED",
    actor: user,
  });

  revalidatePath("/");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${request.contractId}`);
}

export async function cancelContract(formData: FormData) {
  const user = await requirePermission("contracts:cancel", "/contratos");
  const contractId = String(formData.get("contractId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });

  if (!contract || contract.status === CONTRACT_STATUS.CANCELLED) return;

  await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: CONTRACT_STATUS.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: reason || null,
    },
  });

  await prisma.signatureRequest.updateMany({
    where: {
      contractId,
      status: { in: [SIGNATURE_STATUS.PENDING, SIGNATURE_STATUS.VIEWED] },
    },
    data: { status: SIGNATURE_STATUS.REVOKED },
  });

  await recordAudit({
    entityType: "Contract",
    entityId: contractId,
    action: "CANCELLED",
    actor: user,
    metadata: { reason },
  });

  revalidatePath("/");
  revalidatePath("/contenidos");
  revalidatePath(`/contratos/${contractId}`);
  revalidatePath("/contratos");
}

export async function deleteContract(formData: FormData) {
  const user = await requirePermission("contracts:cancel", "/contratos");
  const contractId = String(formData.get("contractId") ?? "");

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { deliverables: true, signatureRequests: true, children: true },
  });

  if (!contract) return;

  const deletable = canDeleteContract({
    status: contract.status,
    signatureCount: contract.signatureRequests.length,
    publishedCount: countPublished(contract.deliverables),
    childCount: contract.children.length,
  });

  if (!deletable) {
    return;
  }

  const creatorId = contract.creatorId;
  const siblings = await prisma.contract.count({ where: { creatorId } });

  await prisma.contract.delete({ where: { id: contractId } });

  await recordAudit({
    entityType: "Contract",
    entityId: contractId,
    action: "DELETED",
    actor: user,
    metadata: { code: contract.code },
  });

  revalidatePath("/contratos");
  revalidatePath("/creators");

  redirect(siblings > 1 ? `/creators/${creatorId}` : "/creators");
}

export async function createRenewal(
  _prev: ContractActionResult | null,
  formData: FormData
): Promise<ContractActionResult> {
  const user = await requirePermission("contracts:renew", "/contratos");
  const parentId = String(formData.get("parentId") ?? "");

  const parent = await prisma.contract.findUnique({ where: { id: parentId } });

  if (!parent) {
    return { ok: false, error: "El contrato de origen no existe." };
  }

  const parsed = renewalSchema.safeParse({
    mode: formData.get("mode"),
    deliverableCount: formData.get("deliverableCount"),
    salePricePerContent: formData.get("salePricePerContent"),
    costCurrency: formData.get("costCurrency"),
    costPerContent: formData.get("costPerContent"),
    fxUnitsPerUsd: formData.get("fxUnitsPerUsd"),
    paymentTermDays: formData.get("paymentTermDays"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const data = parsed.data;

  const costMinorPerContent = parseAmountToMinorUnits(
    data.costPerContent,
    data.costCurrency
  );
  const salePriceCentsPerContent = parseAmountToMinorUnits(
    data.salePricePerContent,
    "USD"
  );

  if (costMinorPerContent === null || salePriceCentsPerContent === null) {
    return { ok: false, error: "Revisa los importes." };
  }

  if (
    data.mode === CONTRACT_KIND.ANNEX &&
    !isAnnexAllowed(parent, { costCurrency: data.costCurrency, costMinorPerContent })
  ) {
    return {
      ok: false,
      error:
        "El coste del creator cambia, así que no puede ser un anexo: crea una renovación con contrato nuevo.",
    };
  }

  const fx = await resolveFxRate(data.costCurrency, data.fxUnitsPerUsd);

  if (fx.unitsPerUsd <= 0) {
    return {
      ok: false,
      fieldErrors: {
        fxUnitsPerUsd: `No hay tipo de cambio guardado para ${data.costCurrency}. Escríbelo a mano.`,
      },
    };
  }

  if (data.fxUnitsPerUsd) {
    await upsertFxRate(data.costCurrency, data.fxUnitsPerUsd);
  }

  const kind = data.mode as ContractKind;

  const contract = await createContract({
    creatorId: parent.creatorId,
    kind,
    parent,
    economics: {
      deliverableCount: data.deliverableCount,
      salePriceCentsPerContent,
      costCurrency: data.costCurrency,
      costMinorPerContent,
      costUsdCentsPerContent: costPerContentUsdCents(
        costMinorPerContent,
        data.costCurrency,
        fx.unitsPerUsd
      ),
      fxUnitsPerUsd: fx.unitsPerUsd,
      fxRateAt: fx.rateAt,
      fxSource: fx.source,
      paymentTermDays: data.paymentTermDays,
      notes: data.notes,
    },
    createdBy: user.email,
  });

  await markParentRenewed(parent.id, kind);

  await recordAudit({
    entityType: "Contract",
    entityId: contract.id,
    action: kind === CONTRACT_KIND.ANNEX ? "ANNEX_CREATED" : "RENEWAL_CREATED",
    actor: user,
    metadata: { code: contract.code, parentCode: parent.code },
  });

  revalidatePath(`/creators/${parent.creatorId}`);
  revalidatePath("/contratos");
  redirect(`/contratos/${contract.id}`);
}
