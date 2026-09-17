import { prisma } from "@/lib/db";
import {
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
  SIGNATURE_STATUS,
} from "@/lib/domain/enums";

export type OpsAlert = {
  kind: "expired_signature" | "unsigned_published";
  contractId: string;
  code: string;
  handle: string;
  expiresAt?: Date | null;
  publishedCount?: number;
};

export type OpsAlertsSnapshot = {
  items: OpsAlert[];
  expiredCount: number;
  unsignedPublishedCount: number;
  missingLinkCount: number;
  platformErrorCount: number;
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

const liveStatuses = [
  DELIVERABLE_STATUS.PUBLISHED,
  DELIVERABLE_STATUS.SUBMITTED,
];

export async function loadOpsAlerts(now = new Date()): Promise<OpsAlertsSnapshot> {
  const expiredWhere = {
    status: { in: [SIGNATURE_STATUS.PENDING, SIGNATURE_STATUS.VIEWED] },
    expiresAt: { lt: now },
    contract: {
      status: { in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT] },
    },
  };
  const unsignedWhere = {
    status: { in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT] },
    deliverables: { some: { status: { in: liveStatuses } } },
  };

  const [
    expiredRequests,
    expiredCount,
    unsignedContracts,
    unsignedPublishedCount,
    missingLinkCount,
    platformErrorCount,
  ] = await Promise.all([
    prisma.signatureRequest.findMany({
      where: expiredWhere,
      orderBy: { expiresAt: "asc" },
      take: 8,
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
    prisma.signatureRequest.count({ where: expiredWhere }),
    prisma.contract.findMany({
      where: unsignedWhere,
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        code: true,
        creator: { select: { handle: true } },
        _count: {
          select: {
            deliverables: { where: { status: { in: liveStatuses } } },
          },
        },
      },
    }),
    prisma.contract.count({ where: unsignedWhere }),
    prisma.deliverable.count({
      where: {
        status: DELIVERABLE_STATUS.PUBLISHED,
        postUrl: null,
        contract: { status: { not: CONTRACT_STATUS.CANCELLED } },
      },
    }),
    prisma.deliverable.count({
      where: { platformSubmitError: { not: null } },
    }),
  ]);

  const expired: OpsAlert[] = expiredRequests.map((request) => ({
    kind: "expired_signature",
    contractId: request.contract.id,
    code: request.contract.code,
    handle: request.contract.creator.handle,
    expiresAt: request.expiresAt,
  }));

  const unsignedPublished: OpsAlert[] = unsignedContracts.map((contract) => ({
    kind: "unsigned_published",
    contractId: contract.id,
    code: contract.code,
    handle: contract.creator.handle,
    publishedCount: contract._count.deliverables,
  }));

  return {
    items: [...expired, ...unsignedPublished],
    expiredCount,
    unsignedPublishedCount,
    missingLinkCount,
    platformErrorCount,
  };
}
