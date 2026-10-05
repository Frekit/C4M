import { prisma } from "@/lib/db";
import { quotePackageText } from "@/lib/domain/creator-cost-quote";
import { DELIVERABLE_STATUS_LABELS, type DeliverableStatus } from "@/lib/domain/enums";
import { isLiveDeliverable } from "@/lib/domain/rules";
import { formatMoney } from "@/lib/money";

export type CampaignResultRow = {
  id: string;
  handle: string;
  networkLabel: string;
  formatLabel: string;
  saleLabel: string;
  costLabel: string;
  statusLabel: string;
  postUrl: string | null;
  live: boolean;
  missingUrl: boolean;
  saleCents: number;
  costMinor: number;
  costCurrency: string;
};

export type CampaignResults = {
  rows: CampaignResultRow[];
  published: number;
  missingUrl: number;
  saleCents: number;
  costLabel: string;
};

function isDeliverableStatus(value: string): value is DeliverableStatus {
  return Object.prototype.hasOwnProperty.call(DELIVERABLE_STATUS_LABELS, value);
}

export async function loadCampaignResults(campaignId: string): Promise<CampaignResults> {
  const deliverables = await prisma.deliverable.findMany({
    where: { campaignId },
    orderBy: [{ contract: { creator: { handle: "asc" } } }, { position: "asc" }],
    select: {
      id: true,
      status: true,
      postUrl: true,
      contract: {
        select: {
          salePriceCentsPerContent: true,
          costMinorPerContent: true,
          costCurrency: true,
          creator: { select: { id: true, handle: true } },
        },
      },
    },
  });

  const creatorIds = [
    ...new Set(deliverables.map((item) => item.contract.creator.id)),
  ];
  const talents =
    creatorIds.length === 0
      ? []
      : await prisma.campaignTalent.findMany({
          where: { campaignId, creatorId: { in: creatorIds } },
          orderBy: { createdAt: "desc" },
          select: {
            creatorId: true,
            contentPlatform: true,
            contentFormat: true,
            deliverableCount: true,
          },
        });
  const talentByCreator = new Map<string, (typeof talents)[number]>();
  for (const talent of talents) {
    if (!talentByCreator.has(talent.creatorId)) {
      talentByCreator.set(talent.creatorId, talent);
    }
  }

  const rows: CampaignResultRow[] = deliverables.map((item) => {
    const live = isLiveDeliverable(item.status);
    const talent = talentByCreator.get(item.contract.creator.id);
    const formatLabel =
      quotePackageText(
        talent?.contentPlatform,
        talent?.contentFormat,
        talent?.deliverableCount ?? 1
      ) ?? "—";
    return {
      id: item.id,
      handle: item.contract.creator.handle,
      networkLabel: formatLabel.includes(" · ")
        ? formatLabel.split(" · ")[0]
        : "—",
      formatLabel,
      saleLabel: formatMoney(item.contract.salePriceCentsPerContent, "USD"),
      costLabel: formatMoney(
        item.contract.costMinorPerContent,
        item.contract.costCurrency
      ),
      statusLabel: isDeliverableStatus(item.status)
        ? DELIVERABLE_STATUS_LABELS[item.status]
        : item.status,
      postUrl: item.postUrl,
      live,
      missingUrl: live && !item.postUrl,
      saleCents: item.contract.salePriceCentsPerContent,
      costMinor: item.contract.costMinorPerContent,
      costCurrency: item.contract.costCurrency,
    };
  });

  const currencies = new Set(rows.map((row) => row.costCurrency));
  const costMinor = rows.reduce((sum, row) => sum + row.costMinor, 0);
  const costLabel =
    rows.length === 0
      ? "—"
      : currencies.size === 1
        ? formatMoney(costMinor, [...currencies][0])
        : "Varias monedas";

  return {
    rows,
    published: rows.filter((row) => row.live).length,
    missingUrl: rows.filter((row) => row.missingUrl).length,
    saleCents: rows.reduce((sum, row) => sum + row.saleCents, 0),
    costLabel,
  };
}
