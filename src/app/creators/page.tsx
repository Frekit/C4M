import Link from "next/link";
import type { Metadata } from "next";
import { PlusIcon, UploadIcon, UserPlusIcon } from "lucide-react";

import { QueryPager } from "@/components/query-pager";
import { ContractStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { CAMPAIGN_TALENT_STATUS_LABELS } from "@/lib/domain/enums";
import {
  creatorsHref,
  loadCreatorsPage,
  type CreatorListFilters,
} from "@/lib/domain/creators-list";
import { CatalogSelect } from "@/components/catalog-select";
import { labelForSlug, loadRosterCatalog } from "@/lib/domain/roster-catalog";

import { RosterCreatorForm } from "./roster-form";

export const metadata: Metadata = {
  title: "Creators",
};

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<CreatorListFilters>;
}) {
  const user = await requireUser("/creators");
  const filters = await searchParams;
  const [data, catalog] = await Promise.all([
    loadCreatorsPage(filters),
    loadRosterCatalog(),
  ]);
  const canWrite = can(user.role, "creators:write");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            Creators
          </h1>
          <p className="text-sm text-muted-foreground">
            Roster único: Instagram, país, tipo y, si ya la tienes, la tarifa
            del creador. La venta al cliente se cierra en la campaña.
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/creators/catalogo" />}
            >
              Listas
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/creators/importar" />}
            >
              <UploadIcon />
              Importar CSV
            </Button>
            <Button nativeButton={false} render={<Link href="/creators/nuevo" />}>
              <PlusIcon />
              Registrar influencer
            </Button>
          </div>
        ) : null}
      </div>

      {canWrite ? (
        <Card>
          <CardHeader>
            <CardTitle>Añadir al roster</CardTitle>
            <CardDescription>
              Sin contrato. La tarifa es lo que le pagamos al creador: puedes
              ponerla ahora o dejarla en blanco y completarla en su ficha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RosterCreatorForm catalog={catalog} />
          </CardContent>
        </Card>
      ) : null}

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Buscar
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Handle o nombre"
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          País
          <CatalogSelect
            name="pais"
            options={catalog.countries}
            defaultValue={filters.pais}
            emptyLabel="Todos"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Tipo
          <CatalogSelect
            name="tipo"
            options={catalog.profileTypes}
            defaultValue={filters.tipo}
            emptyLabel="Todos"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Tarifa
          <select
            name="tarifa"
            defaultValue={filters.tarifa ?? ""}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          >
            <option value="">Todas</option>
            <option value="con">Con tarifa</option>
            <option value="sin">Sin tarifa</option>
          </select>
        </label>
        <Button type="submit" size="sm">
          Buscar
        </Button>
      </form>

      {data.total === 0 ? (
        <Card>
          <CardHeader>
            <UserPlusIcon className="size-5 text-muted-foreground" />
            <CardTitle>
              {data.query
                ? "Nadie coincide con esa búsqueda"
                : "Todavía no hay nadie en el roster"}
            </CardTitle>
            <CardDescription>
              Importa el Excel (Instagram, país, tipo) o añade un perfil aquí.
            </CardDescription>
          </CardHeader>
          {canWrite ? (
            <CardContent className="flex flex-wrap gap-2">
              <Button
                nativeButton={false}
                render={<Link href="/creators/nuevo" />}
                size="lg"
              >
                Registrar el primero
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/creators/importar" />}
              >
                Importar CSV
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0 sm:px-(--card-spacing)">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead className="hidden sm:table-cell">País</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead>Campañas</TableHead>
                  <TableHead className="hidden lg:table-cell">Contratos</TableHead>
                  <TableHead className="hidden xl:table-cell">Entregados</TableHead>
                  <TableHead>Último estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((creator) => {
                  return (
                    <TableRow key={creator.id}>
                      <TableCell>
                        <Link
                          href={`/creators/${creator.id}`}
                          className="font-medium hover:underline"
                        >
                          @{creator.handle}
                        </Link>
                        {creator.displayName ? (
                          <p className="text-xs text-muted-foreground">
                            {creator.displayName}
                          </p>
                        ) : null}
                        {creator.rateLabel ? (
                          <p className="text-xs text-muted-foreground">
                            Tarifa {creator.rateLabel}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Sin tarifa
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {labelForSlug(catalog.countries, creator.country) ?? "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {labelForSlug(catalog.profileTypes, creator.profileType) ??
                          "—"}
                      </TableCell>
                      <TableCell>
                        {creator.campaigns.length === 0 ? (
                          <span className="text-xs text-muted-foreground">
                            Libre
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {creator.campaigns.map((campaign) => (
                              <Badge
                                key={campaign.campaignId}
                                variant="outline"
                                className="font-normal"
                              >
                                <Link href={`/campanas/${campaign.campaignId}`}>
                                  {campaign.clientName
                                    ? `${campaign.clientName} · ${campaign.campaignName}`
                                    : campaign.campaignName}
                                </Link>
                                <span className="text-muted-foreground">
                                  ·{" "}
                                  {
                                    CAMPAIGN_TALENT_STATUS_LABELS[
                                      campaign.talentStatus
                                    ]
                                  }
                                </span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {creator.contractCount}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {creator.published}/{creator.totalDeliverables}
                      </TableCell>
                      <TableCell>
                        {creator.latestStatus ? (
                          <ContractStatusBadge status={creator.latestStatus} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <QueryPager
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              hrefForPage={(page) => creatorsHref(filters, page)}
              noun="creators"
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
