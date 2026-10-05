import { randomBytes } from "node:crypto";

import { getBaseUrl } from "@/lib/base-url";
import { isHttpUrl } from "@/lib/agent/urls";
import { prisma } from "@/lib/db";
import {
  CONTRACT_STATUS,
  RECIPIENT_KIND,
  SIGNATURE_STATUS,
  type RecipientKind,
} from "@/lib/domain/enums";
import { enqueueSignatureMail } from "@/lib/domain/mail-queue";
import { signatureMailCopy } from "@/lib/mail/templates";

export type QueueSignatureResult =
  | {
      ok: true;
      contractId: string;
      code: string;
      handle: string;
      signatureUrl: string;
      requestId: string;
    }
  | { ok: false; contractId: string; error: string };

export async function queueContractSignature(
  input: {
    contractId: string;
    recipientEmail: string;
    recipientKind: RecipientKind;
    expiresInDays: number;
    createdBy: string;
    baseUrl?: string;
  },
  hooks?: { beforeCommit?: () => void }
): Promise<QueueSignatureResult> {
  const baseUrl = (input.baseUrl ?? (await getBaseUrl())).replace(/\/$/, "");
  if (!isHttpUrl(baseUrl)) {
    return {
      ok: false,
      contractId: input.contractId,
      error: "Falta la URL pública de la app.",
    };
  }

  const expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
  const token = randomBytes(32).toString("base64url");
  const signatureUrl = `/firmar/${token}`;

  return prisma.$transaction(async (tx) => {
    const contract = await tx.contract.findUnique({
      where: { id: input.contractId },
      include: {
        signatureRequests: { select: { status: true } },
        creator: { select: { handle: true } },
      },
    });

    if (!contract) {
      return { ok: false as const, contractId: input.contractId, error: "El contrato no existe." };
    }

    if (contract.status === CONTRACT_STATUS.CANCELLED) {
      return {
        ok: false as const,
        contractId: contract.id,
        error: "Un contrato cancelado no se puede enviar a firma.",
      };
    }

    if (contract.signatureRequests.some((request) => request.status === SIGNATURE_STATUS.SIGNED)) {
      return {
        ok: false as const,
        contractId: contract.id,
        error: "Este contrato ya está firmado.",
      };
    }

    await tx.signatureRequest.updateMany({
      where: {
        contractId: contract.id,
        status: { in: [SIGNATURE_STATUS.PENDING, SIGNATURE_STATUS.VIEWED] },
      },
      data: { status: SIGNATURE_STATUS.REVOKED },
    });

    const request = await tx.signatureRequest.create({
      data: {
        contractId: contract.id,
        token,
        recipientEmail: input.recipientEmail,
        recipientKind: input.recipientKind,
        expiresAt,
        sentAt: new Date(),
        createdBy: input.createdBy,
      },
    });

    await tx.contract.update({
      where: { id: contract.id },
      data: { status: CONTRACT_STATUS.SENT },
    });

    const copy = signatureMailCopy({
      handle: contract.creator.handle,
      code: contract.code,
      url: `${baseUrl}${signatureUrl}`,
      expiresAt,
    });

    await enqueueSignatureMail(
      {
        toEmail: input.recipientEmail,
        contractId: contract.id,
        signatureRequestId: request.id,
        subject: copy.subject,
        text: copy.text,
        html: copy.html,
      },
      tx
    );

    hooks?.beforeCommit?.();

    return {
      ok: true as const,
      contractId: contract.id,
      code: contract.code,
      handle: contract.creator.handle,
      signatureUrl,
      requestId: request.id,
    };
  });
}

export type UnsignedQueueReport = {
  queued: number;
  skipped: number;
  errors: string[];
};

export async function queueUnsignedContracts(input: {
  contractIds: string[];
  expiresInDays: number;
  createdBy: string;
  baseUrl?: string;
}): Promise<UnsignedQueueReport> {
  if (input.contractIds.length === 0) {
    return { queued: 0, skipped: 0, errors: [] };
  }

  const baseUrl = input.baseUrl ?? (await getBaseUrl());
  if (!isHttpUrl(baseUrl)) {
    return {
      queued: 0,
      skipped: input.contractIds.length,
      errors: ["Falta la URL pública de la app."],
    };
  }

  const contracts = await prisma.contract.findMany({
    where: { id: { in: input.contractIds } },
    select: {
      id: true,
      creator: { select: { contactEmail: true, handle: true } },
    },
  });

  let queued = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const contract of contracts) {
    const email = contract.creator.contactEmail?.trim().toLowerCase();
    if (!email) {
      skipped += 1;
      continue;
    }

    const result = await queueContractSignature({
      contractId: contract.id,
      recipientEmail: email,
      recipientKind: RECIPIENT_KIND.TALENT,
      expiresInDays: input.expiresInDays,
      createdBy: input.createdBy,
      baseUrl,
    });

    if (result.ok) {
      queued += 1;
      continue;
    }

    skipped += 1;
    if (errors.length < 5) {
      errors.push(`@${contract.creator.handle}: ${result.error}`);
    }
  }

  return { queued, skipped, errors };
}
