import type {
  Contract,
  Deliverable,
  PayeeProfile,
  SignatureRequest,
} from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  CONTRACT_KIND,
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
  SIGNATURE_STATUS,
  type ContractKind,
} from "@/lib/domain/enums";
import { nextContractCode } from "@/lib/domain/contract-code";
import {
  accruedMinor,
  contractTotals,
  deliverableProgress,
  type ContractTotals,
  type DeliverableProgress,
} from "@/lib/domain/contract-math";
import { canDeleteContract, countPublished, isLiveDeliverable } from "@/lib/domain/rules";

export type SignatureWithPayee = SignatureRequest & {
  payee?: PayeeProfile | null;
};

export type ContractWithDetail = Contract & {
  deliverables: Deliverable[];
  signatureRequests: SignatureWithPayee[];
};

export type ContractView = {
  contract: ContractWithDetail;
  totals: ContractTotals;
  progress: DeliverableProgress;
  accruedCostMinor: number;
  activeSignature: SignatureWithPayee | null;
  signedSignature: SignatureWithPayee | null;
  canEditEconomics: boolean;
  canDelete: boolean;
  hasCommitment: boolean;
};

// Un contrato con dinero o firma de por medio no se borra nunca: solo se cancela.
export function hasEconomicCommitment(contract: ContractWithDetail): boolean {
  const signed = contract.signatureRequests.some(
    (request) => request.status === SIGNATURE_STATUS.SIGNED
  );
  const sent = contract.signatureRequests.some(
    (request) =>
      request.status === SIGNATURE_STATUS.PENDING ||
      request.status === SIGNATURE_STATUS.VIEWED
  );
  const published = contract.deliverables.some((item) =>
    isLiveDeliverable(item.status)
  );

  return signed || sent || published;
}

export function buildContractView(contract: ContractWithDetail): ContractView {
  const totals = contractTotals(contract);
  const progress = deliverableProgress(contract.deliverables);
  const hasCommitment = hasEconomicCommitment(contract);

  const activeSignature =
    contract.signatureRequests.find(
      (request) =>
        request.status === SIGNATURE_STATUS.PENDING ||
        request.status === SIGNATURE_STATUS.VIEWED
    ) ?? null;

  const signedSignature =
    contract.signatureRequests.find(
      (request) => request.status === SIGNATURE_STATUS.SIGNED
    ) ?? null;

  return {
    contract,
    totals,
    progress,
    accruedCostMinor: accruedMinor(
      contract.deliverables,
      contract.costMinorPerContent
    ),
    activeSignature,
    signedSignature,
    canEditEconomics:
      contract.status === CONTRACT_STATUS.DRAFT && !hasCommitment,
    canDelete: canDeleteContract({
      status: contract.status,
      signatureCount: contract.signatureRequests.length,
      publishedCount: countPublished(contract.deliverables),
      childCount: 0,
    }),
    hasCommitment,
  };
}

export type ContractEconomicsInput = {
  deliverableCount: number;
  salePriceCentsPerContent: number;
  costCurrency: string;
  costMinorPerContent: number;
  costUsdCentsPerContent: number;
  fxUnitsPerUsd: number;
  fxRateAt: Date;
  fxSource: string;
  paymentTermDays: number;
  notes?: string | null;
};

export async function createContract(input: {
  creatorId: string;
  kind: ContractKind;
  parent?: Contract | null;
  economics: ContractEconomicsInput;
  createdBy: string;
}) {
  const code = await nextContractCode({
    kind: input.kind,
    parentCode: input.parent?.code ?? null,
  });

  const rootId = input.parent
    ? (input.parent.rootId ?? input.parent.id)
    : null;

  return prisma.contract.create({
    data: {
      code,
      creatorId: input.creatorId,
      parentId: input.parent?.id ?? null,
      rootId,
      kind: input.kind,
      status: CONTRACT_STATUS.DRAFT,
      deliverableCount: input.economics.deliverableCount,
      salePriceCentsPerContent: input.economics.salePriceCentsPerContent,
      costCurrency: input.economics.costCurrency,
      costMinorPerContent: input.economics.costMinorPerContent,
      costUsdCentsPerContent: input.economics.costUsdCentsPerContent,
      fxUnitsPerUsd: input.economics.fxUnitsPerUsd,
      fxRateAt: input.economics.fxRateAt,
      fxSource: input.economics.fxSource,
      paymentTermDays: input.economics.paymentTermDays,
      notes: input.economics.notes || null,
      createdBy: input.createdBy,
      deliverables: {
        create: Array.from(
          { length: input.economics.deliverableCount },
          (_, index) => ({ position: index + 1 })
        ),
      },
    },
    include: { deliverables: true, signatureRequests: true },
  });
}

export async function getContractDetail(id: string) {
  return prisma.contract.findUnique({
    where: { id },
    include: {
      creator: true,
      deliverables: { orderBy: { position: "asc" } },
      signatureRequests: {
        orderBy: { createdAt: "desc" },
        include: { payee: true },
      },
      parent: true,
    },
  });
}

// Toda la cadena del contrato: raíz, anexos y renovaciones.
export async function getContractChain(contract: Contract) {
  const rootId = contract.rootId ?? contract.id;

  return prisma.contract.findMany({
    where: { OR: [{ id: rootId }, { rootId }] },
    include: { deliverables: true, signatureRequests: true },
    orderBy: { createdAt: "asc" },
  });
}

// Cuando se publica el último contenido, el contrato queda completado.
export async function syncContractCompletion(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { deliverables: true },
  });

  if (!contract || contract.status === CONTRACT_STATUS.CANCELLED) {
    return;
  }

  const progress = deliverableProgress(contract.deliverables);

  if (progress.isComplete && contract.status !== CONTRACT_STATUS.COMPLETED) {
    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: CONTRACT_STATUS.COMPLETED, completedAt: new Date() },
    });
    return;
  }

  if (!progress.isComplete && contract.status === CONTRACT_STATUS.COMPLETED) {
    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: CONTRACT_STATUS.SIGNED, completedAt: null },
    });
  }
}

// Al nacer un anexo o una renovación, el contrato padre queda marcado.
export async function markParentRenewed(parentId: string, kind: ContractKind) {
  if (kind !== CONTRACT_KIND.RENEWAL) return;

  const parent = await prisma.contract.findUnique({ where: { id: parentId } });
  if (!parent) return;

  if (
    parent.status === CONTRACT_STATUS.COMPLETED ||
    parent.status === CONTRACT_STATUS.SIGNED
  ) {
    await prisma.contract.update({
      where: { id: parentId },
      data: { status: CONTRACT_STATUS.RENEWED },
    });
  }
}
