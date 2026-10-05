import { COST_PLATFORM, type CostPlatform } from "@/lib/domain/creator-cost-quote";
import type { CampaignResults } from "@/lib/domain/campaign-results";
import type { CampaignSheetRow, SheetPulse } from "@/lib/domain/campaign-sheet";
import { formatMoney } from "@/lib/money";

export const DRAFT_MARK = "Borrador para meter en la mesa";

const PLAN_RE = /\b(plan|brief|shortlist|lista|propón|propon|selecci|curad)/i;

export type BriefingDeskLine = {
  handle: string;
  statusLabel: string;
  saleLabel: string | null;
};

export type BriefingPacket = {
  campaignName: string;
  clientName: string | null;
  objective: string | null;
  audience: string | null;
  networks: string | null;
  formats: string | null;
  notes: string | null;
  onDesk: BriefingDeskLine[];
  priced: number;
  active: number;
  savedHandles: string[];
  shortlist: string[];
  published: number;
  total: number;
  missingUrl: number;
  committedSaleLabel: string | null;
  remainingLabel: string | null;
  budgetLabel: string | null;
};

export function assembleBriefing(input: {
  campaignName: string;
  clientName: string | null;
  objective: string | null;
  audience: string | null;
  networks: string | null;
  formats: string | null;
  notes: string | null;
  rows: CampaignSheetRow[];
  pulse: SheetPulse;
  results: Pick<CampaignResults, "published" | "rows" | "missingUrl">;
}): BriefingPacket {
  const onDesk = input.rows.filter((row) => row.place === "open");
  return {
    campaignName: input.campaignName,
    clientName: input.clientName,
    objective: input.objective,
    audience: input.audience,
    networks: input.networks,
    formats: input.formats,
    notes: input.notes,
    onDesk: onDesk.map((row) => ({
      handle: row.handle,
      statusLabel: row.statusLabel,
      saleLabel: row.saleLabel === "—" ? null : row.saleLabel,
    })),
    priced: onDesk.filter((row) => row.saleLabel !== "—").length,
    active: input.rows.filter((row) => row.place === "active").length,
    savedHandles: input.rows
      .filter((row) => row.place === "saved")
      .map((row) => row.handle),
    shortlist: shortlistHandles(input.rows, input.networks),
    published: input.results.published,
    total: input.results.rows.length,
    missingUrl: input.results.missingUrl,
    committedSaleLabel: formatMoney(input.pulse.committedSaleCents, "USD"),
    remainingLabel:
      input.pulse.remainingCents == null
        ? null
        : formatMoney(input.pulse.remainingCents, "USD"),
    budgetLabel:
      input.pulse.budgetSaleCents == null
        ? null
        : formatMoney(input.pulse.budgetSaleCents, "USD"),
  };
}

export function networksMentioned(text: string | null | undefined): CostPlatform[] {
  if (!text) return [];
  const found: CostPlatform[] = [];
  const lower = ` ${text.toLowerCase()} `;
  const checks: [CostPlatform, RegExp][] = [
    [COST_PLATFORM.INSTAGRAM, /\b(instagram|ig)\b/],
    [COST_PLATFORM.TIKTOK, /\btiktok\b/],
    [COST_PLATFORM.LINKEDIN, /\blinkedin\b/],
    [COST_PLATFORM.X, /\b(twitter|x)\b/],
  ];
  for (const [platform, pattern] of checks) {
    if (pattern.test(lower)) found.push(platform);
  }
  return found;
}

export function shortlistHandles(
  rows: Pick<CampaignSheetRow, "handle" | "place" | "platforms">[],
  networksText: string | null | undefined,
  limit = 8
) {
  const networks = networksMentioned(networksText);
  return rows
    .filter((row) => row.place === "out" || row.place === "saved")
    .filter(
      (row) =>
        networks.length === 0 ||
        row.platforms.some((platform) => networks.includes(platform as CostPlatform))
    )
    .slice(0, limit)
    .map((row) => row.handle);
}

export function renderClientStatus(
  packet: Pick<
    BriefingPacket,
    "onDesk" | "published" | "total" | "remainingLabel" | "budgetLabel"
  >
) {
  const count = packet.onDesk.length;
  const published =
    packet.published === 1 ? "1 publicado" : `${packet.published} publicados`;
  const parts = [
    `${count} ${count === 1 ? "perfil en marcha" : "perfiles en marcha"}.`,
    `${published} de ${packet.total}.`,
  ];
  if (packet.remainingLabel && packet.budgetLabel) {
    parts.push(`Quedan ${packet.remainingLabel} de ${packet.budgetLabel}.`);
  }
  return parts.join(" ");
}

function deskLine(line: BriefingDeskLine) {
  const sale =
    line.saleLabel && line.saleLabel !== "—" ? `, venta ${line.saleLabel}` : "";
  return `@${line.handle} (${line.statusLabel}${sale})`;
}

export function renderCampaignBriefing(packet: BriefingPacket, question: string) {
  const lines = [
    packet.clientName
      ? `${packet.campaignName} · ${packet.clientName}`
      : packet.campaignName,
    packet.objective
      ? `Objetivo: ${packet.objective}`
      : "Objetivo: todavía no está escrito en el brief.",
  ];
  if (packet.audience) lines.push(`Audiencia: ${packet.audience}`);
  if (packet.networks) lines.push(`Redes: ${packet.networks}`);
  if (packet.formats) lines.push(`Formatos: ${packet.formats}`);
  if (packet.notes) lines.push(`Notas: ${packet.notes}`);

  lines.push(
    packet.onDesk.length === 0
      ? "En la mesa: nadie todavía."
      : `En la mesa: ${packet.onDesk.map(deskLine).join("; ")}.`
  );
  lines.push(
    packet.savedHandles.length === 0
      ? "Apartados: ninguno."
      : `Apartados: ${packet.savedHandles.map((handle) => `@${handle}`).join(", ")}.`
  );
  lines.push(
    `Publicados: ${packet.published} de ${packet.total}. Sin URL: ${packet.missingUrl}.`
  );
  if (packet.committedSaleLabel) {
    lines.push(`Venta comprometida: ${packet.committedSaleLabel}.`);
  }
  if (packet.remainingLabel && packet.budgetLabel) {
    lines.push(`Queda ${packet.remainingLabel} de ${packet.budgetLabel}.`);
  }
  lines.push(
    `Con precio en la mesa: ${packet.priced}. Activos de una pasada anterior: ${packet.active}.`
  );

  if (PLAN_RE.test(question)) {
    if (packet.shortlist.length === 0) {
      lines.push(
        "No hay perfiles fuera de la mesa que encajen con las redes del brief. No invento handles."
      );
    } else {
      lines.push(`${DRAFT_MARK} (no lo he aplicado):`);
      for (const handle of packet.shortlist) lines.push(`@${handle}`);
      lines.push("La mesa lo aplica si encaja. Yo no escribo la campaña.");
    }
  } else {
    lines.push(
      "Esto es lo que hay en la campaña. Si pides un plan, dejo un borrador de perfiles y no lo aplico."
    );
  }

  return lines.join("\n");
}

export function handlesFromDraft(body: string) {
  const index = body.indexOf(DRAFT_MARK);
  if (index < 0) return [];
  const tail = body.slice(index);
  const handles = new Set<string>();
  for (const match of tail.matchAll(/@([a-z0-9._]+)/gi)) {
    handles.add(match[1].toLowerCase());
  }
  return [...handles];
}
