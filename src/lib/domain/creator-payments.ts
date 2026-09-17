export type PaymentSource = {
  id: string;
  position: number;
  paidAt: Date | null;
  paidByEmail: string | null;
  paidMinor: number | null;
  paidCurrency: string | null;
  postUrl: string | null;
  costMinor: number;
  costCurrency: string;
  contractId: string;
  contractCode: string;
  campaignName: string | null;
  clientName: string | null;
};

export type CreatorPaymentRow = {
  id: string;
  position: number;
  paidAt: Date;
  paidByEmail: string | null;
  amountMinor: number;
  currency: string;
  postUrl: string | null;
  contractId: string;
  contractCode: string;
  campaignName: string | null;
  clientName: string | null;
};

export function settledPayment(item: {
  paidMinor: number | null;
  paidCurrency: string | null;
  costMinor: number;
  costCurrency: string;
}): { amountMinor: number; currency: string } {
  return {
    amountMinor: item.paidMinor ?? item.costMinor,
    currency: item.paidCurrency ?? item.costCurrency,
  };
}

export function creatorPaymentRows(items: PaymentSource[]): CreatorPaymentRow[] {
  return items
    .flatMap((item) => {
      if (!item.paidAt) return [];
      const settled = settledPayment(item);
      return [
        {
          id: item.id,
          position: item.position,
          paidAt: item.paidAt,
          paidByEmail: item.paidByEmail,
          amountMinor: settled.amountMinor,
          currency: settled.currency,
          postUrl: item.postUrl,
          contractId: item.contractId,
          contractCode: item.contractCode,
          campaignName: item.campaignName,
          clientName: item.clientName,
        },
      ];
    })
    .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
}

export function sumPaymentsByCurrency(
  rows: { amountMinor: number; currency: string }[]
): Record<string, number> {
  return rows.reduce<Record<string, number>>((totals, row) => {
    totals[row.currency] = (totals[row.currency] ?? 0) + row.amountMinor;
    return totals;
  }, {});
}

export function paidAuditMetadata(input: {
  paidAt: Date;
  items: Array<{
    id: string;
    position: number;
    creatorId: string;
    creatorHandle: string;
    contractId: string;
    contractCode: string;
    campaignId: string | null;
    amountMinor: number;
    currency: string;
  }>;
}) {
  return {
    count: input.items.length,
    paidAt: input.paidAt.toISOString(),
    items: input.items,
  };
}
