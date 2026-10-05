import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { CatalogSelect } from "@/components/catalog-select";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { networksMentioned } from "@/lib/domain/campaign-briefing";
import {
  filterCampaignSheet,
  loadCampaignSheet,
  type CampaignSheetFilters,
  type SheetPulse,
} from "@/lib/domain/campaign-sheet";
import { COST_PLATFORM_LABELS } from "@/lib/domain/creator-cost-quote";
import { formatMedianViews } from "@/lib/domain/median-views";
import { storedValuesForFilter } from "@/lib/domain/roster-catalog";
import { formatMoney } from "@/lib/money";

import { CampaignSheet } from "./sheet-table";

export const metadata: Metadata = {
  title: "Planilla",
};

const fieldClass =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30";

function PulseTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-heading text-xl font-medium tabular-nums tracking-tight">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function pulseHint(pulse: SheetPulse) {
  if (pulse.budgetSaleCents == null || pulse.remainingCents == null) {
    return pulse.dismissed > 0 ? `${pulse.dismissed} no entran` : undefined;
  }
  const left = `Quedan ${formatMoney(pulse.remainingCents, "USD")}`;
  return pulse.dismissed > 0 ? `${left} · ${pulse.dismissed} no entran` : left;
}

export default async function CampaignSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<CampaignSheetFilters>;
}) {
  const { id } = await params;
  const filters = await searchParams;
  const user = await requireUser(`/campanas/${id}/planilla`);
  const data = await loadCampaignSheet(id);
  if (!data) notFound();

  const pais = filters.pais?.trim() ?? "";
  const tipo = filters.tipo?.trim() ?? "";
  const visible = filterCampaignSheet(data.rows, {
    q: filters.q,
    views: filters.views,
    mesa: filters.mesa,
    red: filters.red,
    countryValues: pais
      ? storedValuesForFilter(data.catalog.countries, pais)
      : undefined,
    typeValues: tipo
      ? storedValuesForFilter(data.catalog.profileTypes, tipo)
      : undefined,
  });
  const canWrite = can(user.role, "campaigns:manage");
  const selectable = visible.filter((row) => row.selectable).length;
  const hasFilter = Boolean(
    filters.q || pais || tipo || filters.views || filters.mesa || filters.red
  );

  return (
    <main className="flex w-full flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            <Link href="/campanas" className="hover:underline">
              Campañas
            </Link>
            {" · "}
            <Link href={`/campanas/${id}`} className="hover:underline">
              {data.campaign.name}
            </Link>
          </p>
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            Planilla
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Filtra la lista y abre un perfil a la derecha para curarlo: views,
            tarifas y marcas. Marca los que entran y mételos de golpe. Quien
            ya está en la mesa se ve, pero no se vuelve a marcar.
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/campanas/${id}`} />}
        >
          Volver a la mesa
        </Button>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Buscar
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Handle, marca, tarifa"
            className={`${fieldClass} w-44`}
          />
        </label>
        <label className="grid min-w-32 gap-1 text-xs text-muted-foreground">
          País
          <CatalogSelect
            name="pais"
            options={data.catalog.countries}
            defaultValue={pais}
            emptyLabel="Todos"
          />
        </label>
        <label className="grid min-w-32 gap-1 text-xs text-muted-foreground">
          Tipo
          <CatalogSelect
            name="tipo"
            options={data.catalog.profileTypes}
            defaultValue={tipo}
            emptyLabel="Todos"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Views
          <select
            name="views"
            defaultValue={filters.views ?? ""}
            className={fieldClass}
          >
            <option value="">Todas</option>
            <option value="al-dia">Al día</option>
            <option value="pendientes">Por actualizar</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          En la campaña
          <select
            name="mesa"
            defaultValue={filters.mesa ?? ""}
            className={fieldClass}
          >
            <option value="">Todos</option>
            <option value="fuera">Fuera</option>
            <option value="abierta">En esta mesa</option>
            <option value="activa">Ya tuvo una pasada</option>
            <option value="descartada">Descartado antes</option>
            <option value="apartada">Apartado</option>
            <option value="no">No entra</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Tarifa
          <select name="red" defaultValue={filters.red ?? ""} className={fieldClass}>
            <option value="">Cualquier red</option>
            {Object.entries(COST_PLATFORM_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
            <option value="sin">Sin tarifas</option>
          </select>
        </label>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
        {hasFilter ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            nativeButton={false}
            render={<Link href={`/campanas/${id}/planilla`} />}
          >
            Quitar filtros
          </Button>
        ) : null}
      </form>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <PulseTile label="En la mesa" value={String(data.pulse.onDesk)} />
        <PulseTile label="Apartados" value={String(data.pulse.saved)} />
        <PulseTile
          label="Views al día"
          value={
            data.pulse.freshViews == null
              ? "—"
              : formatMedianViews(data.pulse.freshViews)
          }
          hint="Suma de quien está en la mesa"
        />
        <PulseTile
          label="Venta comprometida"
          value={formatMoney(data.pulse.committedSaleCents, "USD")}
          hint={pulseHint(data.pulse)}
        />
      </section>

      {data.campaign.briefObjective || data.campaign.briefNetworks ? (
        <p className="max-w-3xl text-sm leading-relaxed">
          {data.campaign.briefObjective ? (
            <span>{data.campaign.briefObjective}</span>
          ) : null}
          {data.campaign.briefNetworks ? (
            <span className="text-muted-foreground">
              {data.campaign.briefObjective ? " · " : ""}
              Redes: {data.campaign.briefNetworks}
            </span>
          ) : null}
          {networksMentioned(data.campaign.briefNetworks).map((network) => (
            <span key={network}>
              <span className="text-muted-foreground"> · </span>
              <Link
                href={`/campanas/${id}/planilla?red=${network}`}
                className="underline underline-offset-4"
              >
                Filtrar {COST_PLATFORM_LABELS[network]}
              </Link>
            </span>
          ))}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Esta campaña todavía no tiene brief. Se escribe en la mesa.
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        {visible.length} de {data.rows.length}
        {data.rows.length === 1 ? " perfil" : " perfiles"}
        {canWrite ? ` · ${selectable} se pueden meter` : ""}
      </p>

      <CampaignSheet campaignId={id} rows={visible} canWrite={canWrite} />
    </main>
  );
}
