"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getBaseUrl } from "@/lib/base-url";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { campaignForClient } from "@/lib/domain/client-campaign";
import { costPerContentUsdCents } from "@/lib/domain/contract-math";
import { createContract, markParentRenewed } from "@/lib/domain/contracts";
import { syncPackSettlement } from "@/lib/domain/pack-sync";
import {
  CONTRACT_KIND,
  CONTRACT_STATUS,
  SIGNATURE_STATUS,
  type ContractKind,
} from "@/lib/domain/enums";
import { resolveFxRate, upsertFxRate } from "@/lib/domain/fx";
import {
  canCreateConditionsAnnex,
  canDeleteContract,
  canEditContractParticulars,
  countPublished,
  isAnnexAllowed,
} from "@/lib/domain/rules";
import {
  conditionsAnnexSchema,
  contractParticularsSchema,
  fieldErrorsFrom,
  newClientContractSchema,
  renewalSchema,
  sendSignatureSchema,
} from "@/lib/domain/validation";
import { parseAmountToMinorUnits } from "@/lib/money";
import { mailStatusCopy, sendMail } from "@/lib/mail/send";
import { signatureMailCopy } from "@/lib/mail/templates";

export type ContractActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  signatureUrl?: string;
  message?: string;
  mailStatus?: "sent" | "skipped" | "failed";
};

async function revokeLiveSignatures(contractId: string) {
  await prisma.signatureRequest.updateMany({
    where: {
      contractId,
      status: { in: [SIGNATURE_STATUS.PENDING, SIGNATURE_STATUS.VIEWED] },
    },
    data: { status: SIGNATURE_STATUS.REVOKED },
  });
}

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
    include: {
      signatureRequests: true,
      creator: { select: { handle: true } },
    },
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
  await revokeLiveSignatures(contractId);

  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
  const token = randomBytes(32).toString("base64url");

  const request = await prisma.signatureRequest.create({
    data: {
      contractId,
      token,
      recipientEmail,
      recipientKind,
      expiresAt,
      sentAt: new Date(),
      createdBy: user.email,
    },
  });

  await prisma.contract.update({
    where: { id: contractId },
    data: { status: CONTRACT_STATUS.SENT },
  });

  const baseUrl = await getBaseUrl();
  const signatureUrl = `/firmar/${token}`;
  const mail = await sendMail({
    to: recipientEmail,
    ...signatureMailCopy({
      handle: contract.creator.handle,
      code: contract.code,
      url: `${baseUrl}${signatureUrl}`,
      expiresAt,
    }),
  });

  await recordAudit({
    entityType: "Contract",
    entityId: contractId,
    action: "SIGNATURE_SENT",
    actor: user,
    metadata: {
      recipientEmail,
      recipientKind,
      requestId: request.id,
      mailStatus: mail.status,
    },
  });

  revalidatePath("/");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${contractId}`);

  return {
    ok: true,
    signatureUrl,
    mailStatus: mail.status,
    message: mailStatusCopy(mail),
  };
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

  if (
    parent.kind === CONTRACT_KIND.CONDITIONS_ANNEX ||
    parent.deliverableCount === 0
  ) {
    return {
      ok: false,
      error:
        "Este anexo no añade contenidos. Amplía o renueva el contrato de origen.",
    };
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
    campaignId: formData.get("campaignId"),
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
  const matched = await campaignForClient(data.campaignId, parent.clientId);
  if (!matched.ok) {
    return { ok: false, fieldErrors: { campaignId: matched.error } };
  }

  const contract = await createContract({
    creatorId: parent.creatorId,
    kind,
    parent,
    clientId: parent.clientId,
    campaignId: matched.campaignId,
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
  await syncPackSettlement({
    campaignId: matched.campaignId,
    creatorId: parent.creatorId,
  });

  await recordAudit({
    entityType: "Contract",
    entityId: contract.id,
    action: kind === CONTRACT_KIND.ANNEX ? "ANNEX_CREATED" : "RENEWAL_CREATED",
    actor: user,
    metadata: {
      code: contract.code,
      parentCode: parent.code,
      campaignId: matched.campaignId,
    },
  });

  revalidatePath(`/creators/${parent.creatorId}`);
  revalidatePath("/contratos");
  revalidatePath("/contenidos");
  revalidatePath("/campanas");
  revalidatePath("/finanzas");
  redirect(`/contratos/${contract.id}`);
}

export async function createClientContract(
  _prev: ContractActionResult | null,
  formData: FormData
): Promise<ContractActionResult> {
  const user = await requirePermission("contracts:write", "/creators");

  const parsed = newClientContractSchema.safeParse({
    creatorId: formData.get("creatorId"),
    clientId: formData.get("clientId"),
    campaignId: formData.get("campaignId"),
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

  const creator = await prisma.creator.findUnique({
    where: { id: data.creatorId },
    include: { contracts: { select: { id: true, clientId: true, status: true } } },
  });

  if (!creator) {
    return { ok: false, error: "Ese creator no existe." };
  }

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) {
    return { ok: false, fieldErrors: { clientId: "Ese cliente no existe." } };
  }

  const already = creator.contracts.find(
    (contract) =>
      contract.clientId === client.id &&
      contract.status !== CONTRACT_STATUS.CANCELLED
  );

  if (already) {
    return {
      ok: false,
      error:
        "Ya tiene un contrato con ese cliente. Para más contenidos, amplía o renueva esa cadena.",
    };
  }

  const matched = await campaignForClient(data.campaignId, client.id);
  if (!matched.ok) {
    return { ok: false, fieldErrors: { campaignId: matched.error } };
  }

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

  const contract = await createContract({
    creatorId: creator.id,
    kind: CONTRACT_KIND.ORIGINAL,
    clientId: client.id,
    campaignId: matched.campaignId,
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

  await syncPackSettlement({
    campaignId: matched.campaignId,
    creatorId: creator.id,
  });

  await recordAudit({
    entityType: "Contract",
    entityId: contract.id,
    action: "CREATED",
    actor: user,
    metadata: {
      code: contract.code,
      clientId: client.id,
      campaignId: matched.campaignId,
    },
  });

  revalidatePath(`/creators/${creator.id}`);
  revalidatePath("/contratos");
  revalidatePath("/contenidos");
  revalidatePath("/campanas");
  revalidatePath("/finanzas");
  redirect(`/contratos/${contract.id}`);
}

export async function updateContractParticulars(
  _prev: ContractActionResult | null,
  formData: FormData
): Promise<ContractActionResult> {
  const user = await requirePermission("contracts:write", "/contratos");

  const parsed = contractParticularsSchema.safeParse({
    contractId: formData.get("contractId"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { contractId, notes } = parsed.data;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { signatureRequests: true },
  });

  if (!contract) {
    return { ok: false, error: "El contrato no existe." };
  }

  const hasSigned = contract.signatureRequests.some(
    (request) => request.status === SIGNATURE_STATUS.SIGNED
  );

  if (!canEditContractParticulars(contract.status, hasSigned)) {
    return {
      ok: false,
      error:
        "Este contrato ya está firmado o cancelado. Si hay que cambiar el jurídico, crea un anexo de condiciones.",
    };
  }

  const hadLiveLink = contract.signatureRequests.some(
    (request) =>
      request.status === SIGNATURE_STATUS.PENDING ||
      request.status === SIGNATURE_STATUS.VIEWED
  );

  await prisma.contract.update({
    where: { id: contractId },
    data: { notes: notes || null },
  });

  if (hadLiveLink) {
    await revokeLiveSignatures(contractId);
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: CONTRACT_STATUS.DRAFT },
    });
  }

  await recordAudit({
    entityType: "Contract",
    entityId: contractId,
    action: "PARTICULARS_UPDATED",
    actor: user,
    metadata: { revokedSignature: hadLiveLink },
  });

  revalidatePath("/");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${contractId}`);

  return {
    ok: true,
    message: hadLiveLink
      ? "Guardado. El enlace de firma anterior ya no vale: genera uno nuevo para que firme este PDF."
      : "Condiciones particulares actualizadas.",
  };
}

export async function createConditionsAnnex(
  _prev: ContractActionResult | null,
  formData: FormData
): Promise<ContractActionResult> {
  const user = await requirePermission("contracts:write", "/contratos");

  const parsed = conditionsAnnexSchema.safeParse({
    parentId: formData.get("parentId"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const parent = await prisma.contract.findUnique({
    where: { id: parsed.data.parentId },
  });

  if (!parent) {
    return { ok: false, error: "El contrato de origen no existe." };
  }

  if (!canCreateConditionsAnnex(parent.status)) {
    return {
      ok: false,
      error:
        "El anexo de condiciones solo se usa cuando el contrato ya está firmado. Si aún no ha firmado, edita las particulares en este mismo documento.",
    };
  }

  const contract = await createContract({
    creatorId: parent.creatorId,
    kind: CONTRACT_KIND.CONDITIONS_ANNEX,
    parent,
    clientId: parent.clientId,
    economics: {
      deliverableCount: 0,
      salePriceCentsPerContent: parent.salePriceCentsPerContent,
      costCurrency: parent.costCurrency,
      costMinorPerContent: parent.costMinorPerContent,
      costUsdCentsPerContent: parent.costUsdCentsPerContent,
      fxUnitsPerUsd: parent.fxUnitsPerUsd,
      fxRateAt: parent.fxRateAt,
      fxSource: parent.fxSource,
      paymentTermDays: parent.paymentTermDays,
      notes: parsed.data.notes,
    },
    createdBy: user.email,
  });

  await recordAudit({
    entityType: "Contract",
    entityId: contract.id,
    action: "CONDITIONS_ANNEX_CREATED",
    actor: user,
    metadata: {
      code: contract.code,
      parentCode: parent.code,
    },
  });

  revalidatePath(`/creators/${parent.creatorId}`);
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${parent.id}`);
  redirect(`/contratos/${contract.id}`);
}
