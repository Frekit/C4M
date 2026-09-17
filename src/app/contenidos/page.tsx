import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
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
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
  DELIVERABLE_STATUS_LABELS,
  DELIVERABLE_STATUS_ORDER,
  SETTLEMENT_MODE,
  type DeliverableStatus,
} from "@/lib/domain/enums";
import { isDeliverableLate, isSignedContract } from "@/lib/domain/rules";
import { isAccruedDeliverable, packKey, settlementPolicyOf } from "@/lib/domain/settlement";
import { loadPackSummaries } from "@/lib/domain/pack-sync";
import { toInputDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

import { BulkCampaignBar } from "./bulk-campaign-bar";
import { ContentRow, type ContentRowData } from "./content-row";

export const metadata: Metadata = {
  title: "Contenidos",
};

type Filters = {
  creador?: string;
  campana?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  retrasados?: string;
};

const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export default async function ContentsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const user = await requireUser("/contenidos");
  const filters = await searchParams;

  const canEdit = can(user.role, "deliverables:publish");
  const canGroup = can(user.role, "campaigns:manage");

  // Los contratos cancelados no ensucian la vista de contenidos.
  const contractFilter: Prisma.ContractWhereInput = {
    status: { not: CONTRACT_STATUS.CANCELLED },
  };

  if (filters.creador) {
    contractFilter.creatorId = filters.creador;
  }

  const where: Prisma.DeliverableWhereInput = { contract: contractFilter };

  if (filters.campana) {
    where.campaignId = filters.campana === "sin" ? null : filters.campana;
  }

  if (
    filters.estado &&
    DELIVERABLE_STATUS_ORDER.includes(filters.estado as DeliverableStatus)
  ) {
    where.status = filters.estado;
  }

  // El rango mira la fecha del contenido (prevista o ya publicada).
  if (filters.desde || filters.hasta) {
    const range: Prisma.DateTimeNullableFilter = {};
    if (filters.desde) range.gte = new Date(`${filters.desde}T00:00:00.000Z`);
    if (filters.hasta) range.lte = new Date(`${filters.hasta}T23:59:59.999Z`);

    where.OR = [{ scheduledFor: range }, { publishedAt: range }];
  }

  if (filters.retrasados === "1") {
    where.status = {
      notIn: [DELIVERABLE_STATUS.PUBLISHED, DELIVERABLE_STATUS.SUBMITTED],
    };
    where.scheduledFor = { lt: new Date() };
  }

  const [deliverables, creators, campaigns, packs] = await Promise.all([
    prisma.deliverable.findMany({
      where,
      orderBy: [
        { scheduledFor: "asc" },
        { publishedAt: "asc" },
        { createdAt: "asc" },
      ],
      include: {
        contract: { include: { creator: true, client: true } },
        campaign: { include: { client: true } },
      },
      take: 500,
    }),
    prisma.creator.findMany({ orderBy: { handle: "asc" } }),
    prisma.campaign.findMany({
      orderBy: { name: "asc" },
      include: { client: true },
    }),
    loadPackSummaries(),
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
      item.campaignId && policy?.settlementMode === SETTLEMENT_MODE.PACK
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
    };
  });

  const counts = DELIVERABLE_STATUS_ORDER.reduce<Record<string, number>>(
    (accumulator, status) => {
      accumulator[status] = rows.filter((row) => row.status === status).length;
      return accumulator;
    },
    {}
  );

  const lateCount = rows.filter((row) => row.isLate).length;

  const accruedByCurrency = deliverables.reduce<Record<string, number>>(
    (accumulator, item) => {
      const policy = settlementPolicyOf({
        client: item.contract.client,
        campaign: item.campaign,
      });
      const pack =
        item.campaignId && policy?.settlementMode === SETTLEMENT_MODE.PACK
          ? packs.get(packKey(item.campaignId, item.contract.creatorId))
          : null;
      if (
        isAccruedDeliverable(
          item.status,
          policy,
          pack?.isComplete ?? false
        )
      ) {
        accumulator[item.contract.costCurrency] =
          (accumulator[item.contract.costCurrency] ?? 0) +
          item.contract.costMinorPerContent;
      }
      return accumulator;
    },
    {}
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

      {rows.length === 0 ? (
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
