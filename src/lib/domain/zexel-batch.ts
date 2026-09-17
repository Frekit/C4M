import { formatZexelAmount } from "@/lib/money";
import type { PayoutGroup } from "@/lib/domain/finance-queues";

export const ZEXEL_CSV_HEADER = "email;importe_destino;moneda_destino";

export type ZexelRecipient = {
  key: string;
  email: string | null;
  payeeName: string | null;
  creatorHandle: string;
  currency: string;
  amountMinor: number;
  itemIds: string[];
};

export type ZexelLote = {
  recipients: ZexelRecipient[];
  ready: ZexelRecipient[];
  missingEmail: ZexelRecipient[];
  csv: string;
  itemIds: string[];
};

export function buildZexelLote(
  groups: PayoutGroup[],
  selectedIds?: Iterable<string>
): ZexelLote {
  const selected =
    selectedIds === undefined ? null : new Set(selectedIds);
  const buckets = new Map<string, ZexelRecipient>();

  for (const group of groups) {
    for (const item of group.items) {
      if (selected && !selected.has(item.id)) continue;

      const email = group.zexelEmail?.trim().toLowerCase() || null;
      const currency = (item.costCurrency || group.payoutCurrency || "EUR")
        .toUpperCase();
      const key = `${email ?? `sin:${group.creatorId}`}:${currency}:${group.creatorId}`;
      const existing = buckets.get(key);

      if (existing) {
        existing.amountMinor += item.costMinor;
        existing.itemIds.push(item.id);
        continue;
      }

      buckets.set(key, {
        key,
        email,
        payeeName: group.payeeName,
        creatorHandle: group.creatorHandle,
        currency,
        amountMinor: item.costMinor,
        itemIds: [item.id],
      });
    }
  }

  const recipients = [...buckets.values()];
  const ready = recipients.filter((row) => row.email);
  const missingEmail = recipients.filter((row) => !row.email);

  return {
    recipients,
    ready,
    missingEmail,
    csv: zexelCsv(ready),
    itemIds: recipients.flatMap((row) => row.itemIds),
  };
}

export function zexelCsv(rows: ZexelRecipient[]): string {
  const lines = [ZEXEL_CSV_HEADER];

  for (const row of rows) {
    if (!row.email) continue;
    lines.push(
      `${row.email};${formatZexelAmount(row.amountMinor, row.currency)};${row.currency}`
    );
  }

  return `${lines.join("\n")}\n`;
}
