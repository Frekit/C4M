import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CAMPAIGN_STATUS, CONTRACT_STATUS } from "@/lib/domain/enums";
import { fromMinorUnits } from "@/lib/money";

import { NewClientContractForm } from "./new-client-contract-form";

export const metadata: Metadata = {
  title: "Nuevo cliente",
};

export default async function NewClientContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePermission("contracts:write", `/creators/${id}/cliente`);

  const creator = await prisma.creator.findUnique({
    where: { id },
    include: {
      contracts: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!creator) {
    notFound();
  }

  const takenClientIds = new Set(
    creator.contracts
      .filter((contract) => contract.status !== CONTRACT_STATUS.CANCELLED)
      .map((contract) => contract.clientId)
      .filter((clientId): clientId is string => Boolean(clientId))
  );

  const [clients, campaigns, rates] = await Promise.all([
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.campaign.findMany({
      where: { status: CAMPAIGN_STATUS.ACTIVE },
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
    prisma.fxRate.findMany({ orderBy: { date: "asc" } }),
  ]);

  const available = clients.filter((client) => !takenClientIds.has(client.id));
  const last = creator.contracts[0];
  const fxRates = rates.reduce<Record<string, number>>((accumulator, rate) => {
    accumulator[rate.currency] = rate.unitsPerUsd;
    return accumulator;
  }, {});

  return (
    <PageShell width="default">
      <div className="space-y-1">
        <h1 className="text-heading-24">
          Meter a @{creator.handle} con otro cliente
        </h1>
        <p className="text-sm text-muted-foreground">
          Higgsfield se queda en su contrato. Esto abre una cadena nueva (Many
          Chat u otro) con sus propios contenidos y su propia liquidación.
        </p>
      </div>

      {available.length === 0 ? (
        <Alert>
          <AlertTitle>No queda ningún cliente libre</AlertTitle>
          <AlertDescription className="grid gap-3">
            <span>
              Ya tiene contrato con todos los clientes dados de alta. Crea el
              cliente en Campañas o amplía la cadena que ya existe.
            </span>
            <Button
              variant="outline"
              className="w-fit"
              nativeButton={false}
              render={<Link href={`/creators/${creator.id}`} />}
            >
              Volver a la ficha
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <NewClientContractForm
          creatorId={creator.id}
          handle={creator.handle}
          clients={available}
          campaigns={campaigns}
          fxRates={fxRates}
          defaults={{
            deliverableCount: last?.deliverableCount ?? 6,
            salePricePerContent: last
              ? String(fromMinorUnits(last.salePriceCentsPerContent, "USD"))
              : "",
            costCurrency: last?.costCurrency ?? creator.payoutCurrency,
            costPerContent: last
              ? String(
                  fromMinorUnits(last.costMinorPerContent, last.costCurrency)
                )
              : "",
            paymentTermDays: last?.paymentTermDays ?? 30,
          }}
        />
      )}
    </PageShell>
  );
}
