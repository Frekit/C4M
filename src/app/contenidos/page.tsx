import Link from "next/link";
import type { Metadata } from "next";
import { FilterIcon, LayoutListIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  CONTENTS_PAGE_SIZE,
  buildDeliverableWhere,
  buildLateDeliverableWhere,
  contentsHref,
  parsePage,
  statusCountsFromGroup,
  withLiveStatus,
  type ContentFilters,
} from "@/lib/domain/contents-query";
import {
  DELIVERABLE_STATUS_LABELS,
  DELIVERABLE_STATUS_ORDER,
} from "@/lib/domain/enums";
import { loadPackSummariesFor } from "@/lib/domain/pack-sync";
import { isDeliverableLate, isSignedContract } from "@/lib/domain/rules";
import {
  isPackSettlement,
  packKey,
  settlementPolicyOf,
  sumAccruedByCurrency,
} from "@/lib/domain/settlement";
import { toInputDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

import { BulkCampaignBar } from "./bulk-campaign-bar";
import { ContentRow, type ContentRowData } from "./content-row";
import { ContentsPager } from "./pager";

export const metadata: Metadata = {
  title: "Contenidos",
};

const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const deliverableOrderBy = [
  { scheduledFor: "asc" as const },
  { publishedAt: "asc" as const },
  { createdAt: "asc" as const },
];

export default async function ContentsPage({
  searchParams,
}: {
  searchParams: Promise<ContentFilters>;
}) {
  const user = await requireUser("/contenidos");
  const filters = await searchParams;

  const canEdit = can(user.role, "deliverables:publish");
  const canGroup = can(user.role, "campaigns:manage");

  const where = buildDeliverableWhere(filters);
  const page = parsePage(filters.pagina);
  const skip = (page - 1) * CONTENTS_PAGE_SIZE;
  const liveWhere = withLiveStatus(where);
  const lateWhere = buildLateDeliverableWhere(filters);

  const [
    deliverables,
    total,
    statusGroups,
    lateCount,
    creators,
    campaigns,
    liveItems,
  ] = await Promise.all([
    prisma.deliverable.findMany({
      where,
      orderBy: deliverableOrderBy,
      skip,
      take: CONTENTS_PAGE_SIZE,
      select: {
        id: true,
        position: true,
        status: true,
        campaignId: true,
        scheduledFor: true,
        publishedAt: true,
        paymentDueAt: true,
        postUrl: true,
        platformSubmitError: true,
        contractId: true,
        contract: {
          select: {
            code: true,
            status: true,
            creatorId: true,
            clientId: true,
            costMinorPerContent: true,
            costCurrency: true,
            creator: { select: { handle: true } },
            client: {
              select: {
                settlementMode: true,
                requiresPlatformSubmit: true,
              },
            },
          },
        },
        campaign: {
          select: {
            client: {
              select: {
                settlementMode: true,
                requiresPlatformSubmit: true,
              },
            },
          },
        },
      },
    }),
    prisma.deliverable.count({ where }),
    prisma.deliverable.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.deliverable.count({ where: lateWhere }),
    prisma.creator.findMany({
      orderBy: { handle: "asc" },
      select: { id: true, handle: true },
    }),
    prisma.campaign.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        clientId: true,
        client: { select: { name: true } },
      },
    }),
    liveWhere
      ? prisma.deliverable.findMany({
          where: liveWhere,
          select: {
            status: true,
            campaignId: true,
            contract: {
              select: {
                creatorId: true,
                costCurrency: true,
                costMinorPerContent: true,
                client: {
                  select: {
                    settlementMode: true,
                    requiresPlatformSubmit: true,
                  },
                },
              },
            },
            campaign: {
              select: {
                client: {
                  select: {
                    settlementMode: true,
                    requiresPlatformSubmit: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const packs = await loadPackSummariesFor([
    ...deliverables.map((item) => item.campaignId),
    ...liveItems.map((item) => item.campaignId),
  ]);

  const campaignOptions = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    clientName: campaign.client?.name ?? null,
    clientId: campaign.clientId,
  }));

  const rows: ContentRowData[] = deliverables.map((item) => {
    const policy = settlementPolicyOf({
      client: item.contract.client,
      campaign: item.campaign,
    });
    const pack =
      item.campaignId && isPackSettlement(policy)
        ? (packs.get(packKey(item.campaignId, item.contract.creatorId)) ?? null)
        : null;

    return {
      id: item.id,
      position: item.position,
      status: item.status,
      campaignId: item.campaignId,
      clientId: item.contract.clientId,
      contentDate: toInputDate(item.publishedAt ?? item.scheduledFor),
      paymentDueAt: item.paymentDueAt?.toISOString() ?? null,
      postUrl: item.postUrl,
      isLate: isDeliverableLate(item),
      costMinor: item.contract.costMinorPerContent,
      costCurrency: item.contract.costCurrency,
      creatorHandle: item.contract.creator.handle,
      creatorId: item.contract.creatorId,
      contractId: item.contractId,
      contractCode: item.contract.code,
      contractSigned: isSignedContract(item.contract.status),
      pack,
      platformSubmitError: item.platformSubmitError,
    };
  });

  const counts = statusCountsFromGroup(statusGroups);
  const accruedByCurrency = sumAccruedByCurrency(
    liveItems.map((item) => ({
      status: item.status,
      campaignId: item.campaignId,
      creatorId: item.contract.creatorId,
      costCurrency: item.contract.costCurrency,
      costMinorPerContent: item.contract.costMinorPerContent,
      policy: settlementPolicyOf({
        client: item.contract.client,
        campaign: item.campaign,
      }),
    })),
    packs
  );

  const hasFilters = Boolean(
    filters.creador ||
      filters.campana ||
      filters.estado ||
      filters.desde ||
      filters.hasta ||
      filters.retrasados
  );

  return (
    <main className="mx-auto flex w-full max-w-full flex-1 flex-col gap-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            Contenidos
          </h1>
          <p className="text-sm text-muted-foreground">
            Todos los contenidos de todos los creators. Se editan aquí mismo.
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

      <div className="flex flex-wrap gap-2">
        {DELIVERABLE_STATUS_ORDER.map((status) => (
          <Badge key={status} variant="outline">
            {DELIVERABLE_STATUS_LABELS[status]}: {counts[status] ?? 0}
          </Badge>
        ))}
        {lateCount > 0 ? (
          <Badge variant="destructive">Con fecha pasada: {lateCount}</Badge>
        ) : null}
        {Object.entries(accruedByCurrency).map(([currency, amount]) => (
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
            El rango de fechas mira la fecha del contenido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
          >
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              Creator
              <select
                name="creador"
                defaultValue={filters.creador ?? ""}
                className={inputClass}
              >
                <option value="">Todos</option>
                {creators.map((creator) => (
                  <option key={creator.id} value={creator.id}>
                    @{creator.handle}
                  </option>
                ))}
              </select>
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
                {campaigns.map((campaign) => (
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
                Solo con fecha pasada
              </label>
              <Button type="submit" size="sm">
                Filtrar
              </Button>
              {hasFilters ? (
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

      {canGroup && rows.length > 0 ? (
        <BulkCampaignBar campaigns={campaignOptions} />
      ) : null}

      {total === 0 ? (
        <Card>
          <CardHeader>
            <LayoutListIcon className="size-5 text-muted-foreground" />
            <CardTitle>
              {hasFilters
                ? "Ningún contenido con esos filtros"
                : "Todavía no hay contenidos"}
            </CardTitle>
            <CardDescription>
              {hasFilters
                ? "Prueba a quitar algún filtro."
                : "Los contenidos se crean solos al registrar un influencer con sus contenidos pactados."}
            </CardDescription>
          </CardHeader>
          {hasFilters ? (
            <CardContent>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/contenidos" />}
              >
                Limpiar filtros
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardHeader>
            <LayoutListIcon className="size-5 text-muted-foreground" />
            <CardTitle>Esta página está vacía</CardTitle>
            <CardDescription>
              Hay {total} contenidos con esos filtros, pero no en la página{" "}
              {page}.
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Creator</TableHead>
                  <TableHead className="min-w-40">Campaña</TableHead>
                  <TableHead className="min-w-36">Estado</TableHead>
                  <TableHead className="min-w-36">Fecha</TableHead>
                  <TableHead className="min-w-48">Enlace</TableHead>
                  <TableHead>Coste</TableHead>
                  <TableHead>Pago previsto</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <ContentRow
                    key={row.id}
                    item={row}
                    campaigns={campaignOptions}
                    canEdit={canEdit}
                  />
                ))}
              </TableBody>
            </Table>
            <ContentsPager
              page={page}
              pageSize={CONTENTS_PAGE_SIZE}
              total={total}
              filters={filters}
            />
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Los cambios se guardan solos. Para marcar como publicado hacen falta
        el enlace y la fecha. Si el contrato aún no está firmado, se puede
        forzar: confirma en el diálogo y la firma sigue pendiente. Con
        clientes de plataforma, Submitted lo marca Finanzas. Con clientes
        pack, no se cobra ni se paga hasta completar todos los contenidos de
        ese perfil en la campaña.
      </p>
    </main>
  );
}
