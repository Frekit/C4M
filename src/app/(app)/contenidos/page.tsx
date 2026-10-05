import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import { FilterIcon, LayoutListIcon } from "lucide-react";

import { CreatorCombobox } from "@/components/creator-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import {
  CONTENTS_PAGE_SIZE,
  contentsHref,
  type ContentFilters,
} from "@/lib/domain/contents-query";
import { loadContentsPage } from "@/lib/domain/contents";
import {
  DELIVERABLE_STATUS_LABELS,
  DELIVERABLE_STATUS_ORDER,
} from "@/lib/domain/enums";
import { formatMoney } from "@/lib/money";

import { BulkCampaignBar } from "./bulk-campaign-bar";
import { ContentsBoard } from "./contents-board";
import { ContentsPager } from "./pager";

export const metadata: Metadata = {
  title: "Contenidos",
};

const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function ContentsPage({
  searchParams,
}: {
  searchParams: Promise<ContentFilters>;
}) {
  const user = await requireUser("/contenidos");
  const filters = await searchParams;
  const canEdit = can(user.role, "deliverables:publish");
  const canGroup = can(user.role, "campaigns:manage");
  const data = await loadContentsPage(filters);

  return (
    <PageShell width="full" className="gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-heading-24">
            Contenidos
          </h1>
          <p className="text-sm text-muted-foreground">
            Todos los contenidos contratados: fecha, publicación, subida al cliente y pago.
          </p>
        </div>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/campanas" />}
        >
          Campañas
        </Button>
      </div>

      <nav className="flex gap-2 overflow-x-auto text-label-13" aria-label="Vistas">
        <Button variant={filters.vista === "necesitan" ? "default" : "outline"} size="sm" nativeButton={false} render={<Link href="/contenidos?vista=necesitan" />}>
          Necesitan algo
        </Button>
        <Button variant={filters.retrasados === "1" ? "default" : "outline"} size="sm" nativeButton={false} render={<Link href="/contenidos?retrasados=1" />}>
          Fecha pasada {data.lateCount}
        </Button>
        <Button variant={filters.sinEnlace === "1" ? "default" : "outline"} size="sm" nativeButton={false} render={<Link href="/contenidos?sinEnlace=1" />}>
          Sin enlace
        </Button>
        <Button variant={filters.vista === "pagar" ? "default" : "outline"} size="sm" nativeButton={false} render={<Link href="/contenidos?vista=pagar" />}>
          Listos para pagar
        </Button>
        <Button variant={!data.hasFilters ? "default" : "outline"} size="sm" nativeButton={false} render={<Link href="/contenidos" />}>
          Todos
        </Button>
      </nav>

      <div className="flex flex-wrap gap-2">
        {DELIVERABLE_STATUS_ORDER.map((status) => (
          <Badge key={status} variant="outline">
            {DELIVERABLE_STATUS_LABELS[status]}: {data.counts[status] ?? 0}
          </Badge>
        ))}
        {data.lateCount > 0 ? (
          <Badge variant="destructive">Con fecha pasada: {data.lateCount}</Badge>
        ) : null}
        {Object.entries(data.accruedByCurrency).map(([currency, amount]) => (
          <Badge key={currency} variant="secondary">
            Devengado: {formatMoney(amount, currency)}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader>
          <FilterIcon className="size-4 text-muted-foreground" />
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            El rango de fechas mira la fecha del contenido. Las colas de
            incidencia (sin enlace, error, sin firmar) recortan el universo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
          >
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Creator
              <CreatorCombobox selected={data.selectedCreator} />
            </label>

            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Campaña
              <select
                name="campana"
                defaultValue={filters.campana ?? ""}
                className={inputClass}
              >
                <option value="">Todas</option>
                <option value="sin">Sin campaña</option>
                {data.campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Estado
              <select
                name="estado"
                defaultValue={filters.estado ?? ""}
                className={inputClass}
              >
                <option value="">Todos</option>
                {DELIVERABLE_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {DELIVERABLE_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Desde
              <input
                type="date"
                name="desde"
                defaultValue={filters.desde ?? ""}
                className={inputClass}
              />
            </label>

            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Hasta
              <input
                type="date"
                name="hasta"
                defaultValue={filters.hasta ?? ""}
                className={inputClass}
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="retrasados"
                  value="1"
                  defaultChecked={filters.retrasados === "1"}
                  className="size-4 accent-primary"
                />
                Retrasados
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="sinEnlace"
                  value="1"
                  defaultChecked={filters.sinEnlace === "1"}
                  className="size-4 accent-primary"
                />
                Sin enlace
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="errorPlataforma"
                  value="1"
                  defaultChecked={filters.errorPlataforma === "1"}
                  className="size-4 accent-primary"
                />
                Error plataforma
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="sinFirmar"
                  value="1"
                  defaultChecked={filters.sinFirmar === "1"}
                  className="size-4 accent-primary"
                />
                Sin firmar
              </label>
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {data.hasFilters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/contenidos" />}
                >
                  Limpiar
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {canGroup && data.total > 0 ? (
        <BulkCampaignBar
          campaigns={data.campaignOptions}
          filters={filters}
          matchingCount={data.total}
        />
      ) : null}

      {data.total === 0 ? (
        <Card>
          <CardHeader>
            <LayoutListIcon className="size-5 text-muted-foreground" />
            <CardTitle className="font-serif text-[22px] leading-7">
              {filters.vista === "necesitan"
                ? "Todo al día"
                : data.hasFilters
                  ? "Nada con estos filtros"
                  : "Todavía no hay contenidos"}
            </CardTitle>
            <CardDescription>
              {filters.vista === "necesitan"
                ? "Ningún contenido necesita nada ahora mismo."
                : data.hasFilters
                  ? "Prueba a quitar algún filtro."
                  : "Los contenidos se crean solos al registrar un influencer con sus contenidos pactados."}
            </CardDescription>
          </CardHeader>
          {data.hasFilters ? (
            <CardContent>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/contenidos" />}
              >
                Quitar filtros
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : data.rows.length === 0 ? (
        <Card>
          <CardHeader>
            <LayoutListIcon className="size-5 text-muted-foreground" />
            <CardTitle>Esta página está vacía</CardTitle>
            <CardDescription>
              Hay {data.total} contenidos con esos filtros, pero no en la página{" "}
              {data.page}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={contentsHref(filters, 1)} />}
            >
              Ir a la primera página
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0">
            <ContentsBoard rows={data.rows} canEdit={canEdit} />
            <ContentsPager
              page={data.page}
              pageSize={CONTENTS_PAGE_SIZE}
              total={data.total}
              filters={filters}
            />
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Los cambios se guardan solos. Para marcar como publicado hacen falta
        el enlace y la fecha. Si el contrato aún no está firmado, se puede
        forzar: confirma en el diálogo y la firma sigue pendiente. Con
        clientes de plataforma, En plataforma lo marca Finanzas. Con clientes
        pack, no se cobra ni se paga hasta completar todos los contenidos de
        ese perfil en la campaña.
      </p>
    </PageShell>
  );
}
