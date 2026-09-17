import Link from "next/link";
import type { Metadata } from "next";
import { FileTextIcon } from "lucide-react";

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
import { prisma } from "@/lib/db";
import { deliverableProgress } from "@/lib/domain/contract-math";
import { CONTRACT_KIND_LABELS, type ContractKind } from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Contratos",
};

export default async function ContractsPage() {
  const user = await requireUser("/contratos");

  const contracts = await prisma.contract.findMany({
    orderBy: { createdAt: "desc" },
    include: { creator: true, client: true, deliverables: true },
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            Contratos
          </h1>
          <p className="text-sm text-muted-foreground">
            Contratos iniciales, anexos y renovaciones, del más reciente al más
            antiguo.
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

      {contracts.length === 0 ? (
        <Card>
          <CardHeader>
            <FileTextIcon className="size-5 text-muted-foreground" />
            <CardTitle>Aún no hay contratos</CardTitle>
            <CardDescription>
              Se crean solos al registrar un influencer con sus contenidos y
              precios.
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
                {contracts.map((contract) => {
                  const progress = deliverableProgress(contract.deliverables);

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
                      <TableCell>
                        {contract.client?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        {progress.published}/{progress.total}
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
                        <ContractStatusBadge status={contract.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
