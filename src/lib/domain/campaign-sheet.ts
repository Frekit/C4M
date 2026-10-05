import { prisma } from "@/lib/db";
import { OPEN_TALENT_STATUSES } from "@/lib/domain/campaign-desk";
import {
  COST_PLATFORM_LABELS,
  isCostPlatform,
  quotePackageText,
  sortCostQuotes,
} from "@/lib/domain/creator-cost-quote";
import {
  CAMPAIGN_TALENT_STATUS,
  CAMPAIGN_TALENT_STATUS_LABELS,
  type CampaignTalentStatus,
} from "@/lib/domain/enums";
import { isMedianViewsStale, formatMedianViews } from "@/lib/domain/median-views";
import { labelForSlug } from "@/lib/domain/roster-labels";
import { loadRosterCatalog } from "@/lib/domain/roster-catalog";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

const OPEN = new Set<string>(OPEN_TALENT_STATUSES);

export type SheetPlace = "out" | "open" | "active" | "rejected";

export type SheetRateLine = {
  platform: string;
  platformLabel: string;
  packageLabel: string;
  amountLabel: string;
};

export type CampaignSheetRow = {
  id: string;
  handle: string;
  displayName: string | null;
  country: string | null;
  countryLabel: string;
  profileType: string | null;
  profileTypeLabel: string;
  viewsLabel: string;
  viewsWhen: string;
  viewsStale: boolean;
  quotesLabel: string;
  rates: SheetRateLine[];
  platforms: string[];
  place: SheetPlace;
  selectable: boolean;
  statusLabel: string;
  formatLabel: string;
  piecesLabel: string;
  saleLabel: string;
  costLabel: string;
  othersLabel: string;
};

export type CampaignSheetFilters = {
  q?: string;
  pais?: string;
  tipo?: string;
  views?: string;
  mesa?: string;
  red?: string;
  countryValues?: string[];
  typeValues?: string[];
};

type SheetQuote = {
  platform: string;
  format: string;
  quantity: number;
  costMinor: number;
  currency: string;
};

type SheetTalent = {
  status: string;
  createdAt: Date;
  campaignId: string;
  campaignName: string;
  clientName: string | null;
  deliverableCount: number | null;
  contentPlatform: string | null;
  contentFormat: string | null;
  salePriceCentsPerContent: number | null;
  costMinorPerContent: number | null;
  costCurrency: string | null;
  packageCostMinor: number | null;
};

export type SheetCreatorInput = {
  id: string;
  handle: string;
  displayName: string | null;
  country: string | null;
  countryLabel: string;
  profileType: string | null;
  profileTypeLabel: string;
  igMedianViews: number | null;
  igMedianViewsAt: Date | null;
  quotes: SheetQuote[];
  talents: SheetTalent[];
};

function isTalentStatus(value: string): value is CampaignTalentStatus {
  return Object.prototype.hasOwnProperty.call(CAMPAIGN_TALENT_STATUS_LABELS, value);
}

function latest(rows: SheetTalent[]) {
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
}

function rateLines(quotes: SheetQuote[]): SheetRateLine[] {
  return sortCostQuotes(quotes).flatMap((quote) => {
    const pack = quotePackageText(quote.platform, quote.format, quote.quantity);
    const platform = isCostPlatform(quote.platform) ? quote.platform : null;
    return [
      {
        platform: quote.platform,
        platformLabel: platform ? COST_PLATFORM_LABELS[platform] : quote.platform,
        packageLabel: pack ?? `${quote.quantity} ${quote.format}`,
        amountLabel: formatMoney(quote.costMinor, quote.currency),
      },
    ];
  });
}

function quotesLabel(quotes: SheetQuote[]) {
  const lines = rateLines(quotes);
  if (lines.length === 0) return "Sin tarifas";
  return lines
    .map((line) => `${line.packageLabel} ${line.amountLabel}`)
    .join(" · ");
}

function lineLabels(talent: SheetTalent | null) {
  if (!talent) {
    return { formatLabel: "—", piecesLabel: "—", saleLabel: "—", costLabel: "—" };
  }
  const formatLabel =
    quotePackageText(
      talent.contentPlatform,
      talent.contentFormat,
      talent.deliverableCount ?? 1
    ) ?? "—";
  const piecesLabel =
    talent.deliverableCount != null ? String(talent.deliverableCount) : "—";
  const saleLabel =
    talent.salePriceCentsPerContent != null
      ? `${formatMoney(talent.salePriceCentsPerContent, "USD")} / pieza`
      : "—";
  let costLabel = "—";
  if (talent.packageCostMinor != null && talent.costCurrency) {
    costLabel = `${formatMoney(talent.packageCostMinor, talent.costCurrency)} paquete`;
  } else if (talent.costMinorPerContent != null && talent.costCurrency) {
    costLabel = `${formatMoney(talent.costMinorPerContent, talent.costCurrency)} / pieza`;
  }
  return { formatLabel, piecesLabel, saleLabel, costLabel };
}

export function buildCampaignSheetRow(
  creator: SheetCreatorInput,
  campaignId: string,
  now = new Date()
): CampaignSheetRow {
  const here = creator.talents.filter((talent) => talent.campaignId === campaignId);
  const open = here.filter((talent) => OPEN.has(talent.status));
  let place: SheetPlace = "out";
  let chosen: SheetTalent | null = null;
  if (open.length > 0) {
    place = "open";
    chosen = latest(open);
  } else {
    const active = here.filter((talent) => talent.status === CAMPAIGN_TALENT_STATUS.ACTIVE);
    const rejected = here.filter(
      (talent) => talent.status === CAMPAIGN_TALENT_STATUS.REJECTED
    );
    if (active.length > 0) {
      place = "active";
      chosen = latest(active);
    } else if (rejected.length > 0) {
      place = "rejected";
      chosen = latest(rejected);
    }
  }

  const statusLabel =
    chosen && isTalentStatus(chosen.status)
      ? CAMPAIGN_TALENT_STATUS_LABELS[chosen.status]
      : "Fuera";

  const seen = new Set<string>();
  const others: string[] = [];
  for (const talent of creator.talents) {
    if (talent.campaignId === campaignId || seen.has(talent.campaignId)) continue;
    seen.add(talent.campaignId);
    others.push(
      talent.clientName
        ? `${talent.clientName} · ${talent.campaignName}`
        : talent.campaignName
    );
  }

  const viewsStale = isMedianViewsStale({
    views: creator.igMedianViews,
    recordedAt: creator.igMedianViewsAt,
    now,
  });

  return {
    id: creator.id,
    handle: creator.handle,
    displayName: creator.displayName,
    country: creator.country,
    countryLabel: creator.countryLabel || "—",
    profileType: creator.profileType,
    profileTypeLabel: creator.profileTypeLabel || "—",
    viewsLabel:
      creator.igMedianViews == null
        ? "Sin mediana"
        : formatMedianViews(creator.igMedianViews),
    viewsWhen: creator.igMedianViewsAt ? formatDate(creator.igMedianViewsAt) : "",
    viewsStale,
    quotesLabel: quotesLabel(creator.quotes),
    rates: rateLines(creator.quotes),
    platforms: [
      ...new Set(
        creator.quotes
          .map((quote) => quote.platform)
          .filter((platform) => platform.length > 0)
      ),
    ],
    place,
    selectable: place !== "open",
    statusLabel,
    othersLabel: others.join("; ") || "—",
    ...lineLabels(chosen),
  };
}

export function filterCampaignSheet(
  rows: CampaignSheetRow[],
  filters: CampaignSheetFilters
) {
  const query = filters.q?.trim().toLowerCase() ?? "";
  const views = filters.views?.trim() ?? "";
  const mesa = filters.mesa?.trim() ?? "";
  const red = filters.red?.trim() ?? "";
  const countries = filters.countryValues;
  const types = filters.typeValues;

  return rows.filter((row) => {
    if (query) {
      const haystack = [
        row.handle,
        row.displayName ?? "",
        row.countryLabel,
        row.profileTypeLabel,
        row.quotesLabel,
        row.othersLabel,
        row.statusLabel,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (countries && !countries.includes(row.country ?? "")) return false;
    if (types && !types.includes(row.profileType ?? "")) return false;
    if (views === "pendientes" && !row.viewsStale) return false;
    if (views === "al-dia" && row.viewsStale) return false;
    if (mesa === "fuera" && row.place !== "out") return false;
    if (mesa === "abierta" && row.place !== "open") return false;
    if (mesa === "activa" && row.place !== "active") return false;
    if (mesa === "descartada" && row.place !== "rejected") return false;
    if (red === "sin" && row.platforms.length > 0) return false;
    if (red && red !== "sin" && !row.platforms.includes(red)) return false;
    return true;
  });
}

export async function loadCampaignSheet(campaignId: string, now = new Date()) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true },
  });
  if (!campaign) return null;

  const catalog = await loadRosterCatalog();
  const creators = await prisma.creator.findMany({
    orderBy: { handle: "asc" },
    select: {
      id: true,
      handle: true,
      displayName: true,
      country: true,
      profileType: true,
      igMedianViews: true,
      igMedianViewsAt: true,
      costQuotes: {
        select: {
          platform: true,
          format: true,
          quantity: true,
          costMinor: true,
          currency: true,
        },
      },
      campaignTalents: {
        select: {
          status: true,
          createdAt: true,
          campaignId: true,
          deliverableCount: true,
          contentPlatform: true,
          contentFormat: true,
          salePriceCentsPerContent: true,
          costMinorPerContent: true,
          costCurrency: true,
          packageCostMinor: true,
          campaign: {
            select: { name: true, client: { select: { name: true } } },
          },
        },
      },
    },
  });

  const rows = creators.map((creator) =>
    buildCampaignSheetRow(
      {
        id: creator.id,
        handle: creator.handle,
        displayName: creator.displayName,
        country: creator.country,
        countryLabel: labelForSlug(catalog.countries, creator.country) ?? "",
        profileType: creator.profileType,
        profileTypeLabel:
          labelForSlug(catalog.profileTypes, creator.profileType) ?? "",
        igMedianViews: creator.igMedianViews,
        igMedianViewsAt: creator.igMedianViewsAt,
        quotes: creator.costQuotes,
        talents: creator.campaignTalents.map((talent) => ({
          status: talent.status,
          createdAt: talent.createdAt,
          campaignId: talent.campaignId,
          campaignName: talent.campaign.name,
          clientName: talent.campaign.client?.name ?? null,
          deliverableCount: talent.deliverableCount,
          contentPlatform: talent.contentPlatform,
          contentFormat: talent.contentFormat,
          salePriceCentsPerContent: talent.salePriceCentsPerContent,
          costMinorPerContent: talent.costMinorPerContent,
          costCurrency: talent.costCurrency,
          packageCostMinor: talent.packageCostMinor,
        })),
      },
      campaignId,
      now
    )
  );

  return { campaign, catalog, rows };
}
