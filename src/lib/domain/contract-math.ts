import { convertToUsdCents } from "@/lib/money";
import { isLiveDeliverable } from "@/lib/domain/rules";

export type ContractEconomics = {
  deliverableCount: number;
  salePriceCentsPerContent: number;
  costCurrency: string;
  costMinorPerContent: number;
  fxUnitsPerUsd: number;
  costUsdCentsPerContent: number;
};

export type ContractTotals = {
  saleTotalCents: number;
  costTotalMinor: number;
  costTotalUsdCents: number;
  marginPerContentUsdCents: number;
  marginTotalUsdCents: number;
  marginRatio: number | null;
  hasNegativeMargin: boolean;
};

export function contractTotals(contract: ContractEconomics): ContractTotals {
  const saleTotalCents =
    contract.salePriceCentsPerContent * contract.deliverableCount;
  const costTotalMinor = contract.costMinorPerContent * contract.deliverableCount;
  const costTotalUsdCents =
    contract.costUsdCentsPerContent * contract.deliverableCount;

  const marginPerContentUsdCents =
    contract.salePriceCentsPerContent - contract.costUsdCentsPerContent;
  const marginTotalUsdCents = saleTotalCents - costTotalUsdCents;

  return {
    saleTotalCents,
    costTotalMinor,
    costTotalUsdCents,
    marginPerContentUsdCents,
    marginTotalUsdCents,
    marginRatio: saleTotalCents > 0 ? marginTotalUsdCents / saleTotalCents : null,
    hasNegativeMargin: marginTotalUsdCents < 0,
  };
}

export function costPerContentUsdCents(
  costMinorPerContent: number,
  costCurrency: string,
  fxUnitsPerUsd: number
): number {
  return convertToUsdCents(costMinorPerContent, costCurrency, fxUnitsPerUsd);
}

// Fecha prevista de pago de un contenido: se cuenta desde su publicación,
// no desde la fecha de factura.
export function paymentDueDate(publishedAt: Date, paymentTermDays: number): Date {
  const due = new Date(publishedAt);
  due.setUTCDate(due.getUTCDate() + paymentTermDays);
  return due;
}

export type DeliverableLike = {
  status: string;
  publishedAt: Date | null;
  paymentDueAt: Date | null;
};

export type DeliverableProgress = {
  total: number;
  published: number;
  pending: number;
  ratio: number;
  isComplete: boolean;
};

export function deliverableProgress(
  deliverables: DeliverableLike[]
): DeliverableProgress {
  const total = deliverables.length;
  const published = deliverables.filter((item) =>
    isLiveDeliverable(item.status)
  ).length;

  return {
    total,
    published,
    pending: total - published,
    ratio: total > 0 ? published / total : 0,
    isComplete: total > 0 && published === total,
  };
}

// Lo devengado: lo que ya se debe al creator por contenidos publicados.
export function accruedMinor(
  deliverables: DeliverableLike[],
  costMinorPerContent: number
): number {
  const published = deliverables.filter((item) =>
    isLiveDeliverable(item.status)
  ).length;

  return published * costMinorPerContent;
}
