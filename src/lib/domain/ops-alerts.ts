import { prisma } from "@/lib/db";
import {
  CONTRACT_STATUS,
  SIGNATURE_STATUS,
} from "@/lib/domain/enums";
import { isLiveDeliverable } from "@/lib/domain/rules";

export type OpsAlert = {
  kind: "expired_signature" | "unsigned_published";
  contractId: string;
  code: string;
  handle: string;
  expiresAt?: Date | null;
  publishedCount?: number;
};

export function isExpiredLiveSignature(input: {
  status: string;
  expiresAt: Date;
  now?: Date;
}): boolean {
  if (
    input.status !== SIGNATURE_STATUS.PENDING &&
    input.status !== SIGNATURE_STATUS.VIEWED
  ) {
    return false;
  }
  return input.expiresAt < (input.now ?? new Date());
}

export function isUnsignedWithPublished(input: {
  status: string;
  publishedCount: number;
}): boolean {
  if (
    input.status !== CONTRACT_STATUS.DRAFT &&
    input.status !== CONTRACT_STATUS.SENT
  ) {
    return false;
  }
  return input.publishedCount > 0;
}

export async function loadOpsAlerts(now = new Date()): Promise<OpsAlert[]> {
  const [expiredRequests, unsignedContracts] = await Promise.all([
    prisma.signatureRequest.findMany({
      where: {
        status: {
          in: [SIGNATURE_STATUS.PENDING, SIGNATURE_STATUS.VIEWED],
        },
        expiresAt: { lt: now },
        contract: {
          status: { in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT] },
        },
      },
      orderBy: { expiresAt: "asc" },
      take: 12,
      select: {
        expiresAt: true,
        contract: {
          select: {
            id: true,
            code: true,
            creator: { select: { handle: true } },
          },
        },
      },
    }),
    prisma.contract.findMany({
      where: {
        status: { in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT] },
      },
      select: {
        id: true,
        code: true,
        status: true,
        creator: { select: { handle: true } },
        deliverables: { select: { status: true } },
      },
    }),
  ]);

  const expired: OpsAlert[] = expiredRequests.map((request) => ({
    kind: "expired_signature",
    contractId: request.contract.id,
    code: request.contract.code,
    handle: request.contract.creator.handle,
    expiresAt: request.expiresAt,
  }));

  const unsignedPublished: OpsAlert[] = unsignedContracts.flatMap((contract) => {
    const publishedCount = contract.deliverables.filter((item) =>
      isLiveDeliverable(item.status)
    ).length;
    if (!isUnsignedWithPublished({ status: contract.status, publishedCount })) {
      return [];
    }
    return [
      {
        kind: "unsigned_published" as const,
        contractId: contract.id,
        code: contract.code,
        handle: contract.creator.handle,
        publishedCount,
      },
    ];
  });

  return [...expired, ...unsignedPublished].slice(0, 20);
}
