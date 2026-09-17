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
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import {
  creatorsHref,
  loadCreatorsPage,
  type CreatorListFilters,
} from "@/lib/domain/creators-list";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

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
  const data = await loadCreatorsPage(filters);
  const canWrite = can(user.role, "creators:write");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            Creators
          </h1>
          <p className="text-sm text-muted-foreground">
            Lista paginada. Para 1.000 altas, importa el CSV; no abras el
            universo entero.
          </p>
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
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
                : "Todavía no hay nadie registrado"}
            </CardTitle>
            <CardDescription>
              Empieza dando de alta un influencer o importa un CSV de campaña.
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
                  <TableHead className="hidden sm:table-cell">Contratos</TableHead>
                  <TableHead>Entregados</TableHead>
                  <TableHead className="hidden md:table-cell">Coste pactado</TableHead>
                  <TableHead className="hidden lg:table-cell">Alta</TableHead>
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
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {creator.contractCount}
                      </TableCell>
                      <TableCell>
                        {creator.published}/{creator.totalDeliverables}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {Object.entries(creator.costByCurrency).map(
                          ([currency, amount]) => (
                            <span key={currency} className="block text-sm">
                              {formatMoney(amount, currency)}
                            </span>
                          )
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {formatDate(creator.createdAt)}
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
