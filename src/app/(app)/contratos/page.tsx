import Link from "next/link";
import type { Metadata } from "next";
import { FileTextIcon } from "lucide-react";

import { QueryPager } from "@/components/query-pager";
import { ContractStatusBadge } from "@/components/status-badge";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import {
  contractsHref,
  loadContractsPage,
  type ContractListFilters,
} from "@/lib/domain/contracts-list";
import {
  CONTRACT_KIND_LABELS,
  CONTRACT_STATUS,
  CONTRACT_STATUS_LABELS,
  type ContractKind,
  type ContractStatus,
} from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

import { ContractsBulkSignature } from "./bulk-signature";

export const metadata: Metadata = {
  title: "Contratos",
};

const inputClass =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<ContractListFilters>;
}) {
  const user = await requireUser("/contratos");
  const filters = await searchParams;
  const data = await loadContractsPage(filters);
  const canSign = can(user.role, "signature:send");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            Contratos
          </h1>
          <p className="text-sm text-muted-foreground">
            Lista paginada. Filtra por campaña antes de enviar a firma en lote.
          </p>
        </div>
        {can(user.role, "creators:write") ? (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/creators/nuevo" />}
          >
            Registrar influencer
          </Button>
        ) : null}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Campaña
          <select
            name="campana"
            defaultValue={filters.campana ?? ""}
            className={inputClass}
          >
            <option value="">Todas</option>
            {data.campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Estado
          <select
            name="estado"
            defaultValue={filters.estado ?? ""}
            className={inputClass}
          >
            <option value="">Todos</option>
            {Object.values(CONTRACT_STATUS).map((status) => (
              <option key={status} value={status}>
                {CONTRACT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
        {filters.campana || filters.estado ? (
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/contratos" />}
          >
            Limpiar
          </Button>
        ) : null}
      </form>

      {canSign && (filters.campana || filters.estado) ? (
        <ContractsBulkSignature
          unsignedCount={data.unsignedCount}
          campaignId={filters.campana}
          status={filters.estado}
        />
      ) : null}

      {data.total === 0 ? (
        <Card>
          <CardHeader>
            <FileTextIcon className="size-5 text-muted-foreground" />
            <CardTitle>
              {filters.campana || filters.estado
                ? "Ningún contrato con esos filtros"
                : "Aún no hay contratos"}
            </CardTitle>
            <CardDescription>
              Se crean al registrar un influencer o al importar un CSV.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="px-0 sm:px-(--card-spacing)">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Entregados</TableHead>
                  <TableHead className="hidden md:table-cell">Coste</TableHead>
                  <TableHead className="hidden lg:table-cell">Venta</TableHead>
                  <TableHead className="hidden sm:table-cell">Creado</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((contract) => {
                  return (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <Link
                          href={`/contratos/${contract.id}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {contract.code}
                        </Link>
                        {contract.kind !== "ORIGINAL" ? (
                          <Badge variant="outline" className="ml-2">
                            {CONTRACT_KIND_LABELS[contract.kind as ContractKind]}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/creators/${contract.creatorId}`}
                          className="hover:underline"
                        >
                          @{contract.creator.handle}
                        </Link>
                      </TableCell>
                      <TableCell>{contract.client?.name ?? "—"}</TableCell>
                      <TableCell>
                        {contract._count.deliverables}/{contract.deliverableCount}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatMoney(
                          contract.costMinorPerContent * contract.deliverableCount,
                          contract.costCurrency
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {formatMoney(
                          contract.salePriceCentsPerContent *
                            contract.deliverableCount,
                          "USD"
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {formatDate(contract.createdAt)}
                      </TableCell>
                      <TableCell>
                        <ContractStatusBadge
                          status={contract.status as ContractStatus}
                        />
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
              hrefForPage={(page) => contractsHref(filters, page)}
              noun="contratos"
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
