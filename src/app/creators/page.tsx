import Link from "next/link";
import type { Metadata } from "next";
import { PlusIcon, UserPlusIcon } from "lucide-react";

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
import { prisma } from "@/lib/db";
import { deliverableProgress } from "@/lib/domain/contract-math";
import { CONTRACT_STATUS } from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Creators",
};

export default async function CreatorsPage() {
  const user = await requireUser("/creators");

  const creators = await prisma.creator.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      contracts: {
        include: { deliverables: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const canWrite = can(user.role, "creators:write");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            Creators
          </h1>
          <p className="text-sm text-muted-foreground">
            Cada creator tiene su cadena de contratos: inicial, anexos y
            renovaciones.
          </p>
        </div>
        {canWrite ? (
          <Button nativeButton={false} render={<Link href="/creators/nuevo" />}>
            <PlusIcon />
            Registrar influencer
          </Button>
        ) : null}
      </div>

      {creators.length === 0 ? (
        <Card>
          <CardHeader>
            <UserPlusIcon className="size-5 text-muted-foreground" />
            <CardTitle>Todavía no hay nadie registrado</CardTitle>
            <CardDescription>
              Empieza dando de alta un influencer con su enlace de Instagram, los
              contenidos pactados y los precios. El contrato se genera solo.
            </CardDescription>
          </CardHeader>
          {canWrite ? (
            <CardContent>
              <Button
                nativeButton={false}
                render={<Link href="/creators/nuevo" />}
                size="lg"
              >
                Registrar el primero
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
                {creators.map((creator) => {
                  const allDeliverables = creator.contracts.flatMap(
                    (contract) => contract.deliverables
                  );
                  const progress = deliverableProgress(allDeliverables);
                  const activeContracts = creator.contracts.filter(
                    (contract) => contract.status !== CONTRACT_STATUS.CANCELLED
                  );
                  const costByCurrency = activeContracts.reduce<
                    Record<string, number>
                  >((accumulator, contract) => {
                    accumulator[contract.costCurrency] =
                      (accumulator[contract.costCurrency] ?? 0) +
                      contract.costMinorPerContent * contract.deliverableCount;
                    return accumulator;
                  }, {});

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
                        {creator.contracts.length}
                      </TableCell>
                      <TableCell>
                        {progress.published}/{progress.total}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {Object.entries(costByCurrency).map(
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
                        {creator.contracts[0] ? (
                          <ContractStatusBadge
                            status={creator.contracts[0].status}
                          />
                        ) : (
                          "—"
                        )}
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
