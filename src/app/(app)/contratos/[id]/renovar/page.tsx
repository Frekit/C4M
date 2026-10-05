import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { deliverableProgress } from "@/lib/domain/contract-math";
import {
  CAMPAIGN_STATUS,
  CONTRACT_KIND,
  CONTRACT_STATUS,
  SETTLEMENT_MODE_LABELS,
  type SettlementMode,
} from "@/lib/domain/enums";
import { formatMoney } from "@/lib/money";
import { fromMinorUnits } from "@/lib/money";

import { RenewalForm } from "./renewal-form";

export const metadata: Metadata = {
  title: "Ampliar o renovar",
};

export default async function RenewContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePermission("contracts:renew", `/contratos/${id}/renovar`);

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { creator: true, client: true, deliverables: true },
  });

  if (!contract) {
    notFound();
  }

  if (
    contract.kind === CONTRACT_KIND.CONDITIONS_ANNEX ||
    contract.deliverableCount === 0
  ) {
    notFound();
  }

  const [rates, campaigns] = await Promise.all([
    prisma.fxRate.findMany({ orderBy: { date: "asc" } }),
    prisma.campaign.findMany({
      where: {
        status: CAMPAIGN_STATUS.ACTIVE,
        ...(contract.clientId ? { clientId: contract.clientId } : {}),
      },
      orderBy: { name: "asc" },
      include: { client: true },
    }),
  ]);
  const fxRates = rates.reduce<Record<string, number>>((accumulator, rate) => {
    accumulator[rate.currency] = rate.unitsPerUsd;
    return accumulator;
  }, {});

  const progress = deliverableProgress(contract.deliverables);
  const isCancelled = contract.status === CONTRACT_STATUS.CANCELLED;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Ampliar {contract.client?.name ?? "el contrato"} con @
          {contract.creator.handle}
        </h1>
        <p className="text-sm text-muted-foreground">
          Sigue siendo {contract.client?.name ?? "el mismo cliente"}. Para
          Many Chat u otro cliente, ábrele un contrato nuevo desde su ficha.
          Partimos de {contract.code}, con {progress.published} de{" "}
          {progress.total} contenidos entregados.
        </p>
      </div>

      {isCancelled ? (
        <Alert variant="destructive">
          <AlertTitle>Ese contrato está cancelado</AlertTitle>
          <AlertDescription className="grid gap-2">
            <span>
              No tiene sentido ampliarlo. Registra un contrato nuevo desde la
              ficha del creator.
            </span>
            <Button
              variant="outline"
              className="w-fit"
              nativeButton={false}
              render={<Link href={`/creators/${contract.creatorId}`} />}
            >
              Ir a la ficha
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {!progress.isComplete ? (
            <Alert>
              <AlertTitle>Este contrato aún no está completo</AlertTitle>
              <AlertDescription>
                Quedan {progress.pending} contenidos por entregar. Puedes ampliar
                igualmente, pero suele tener más sentido esperar a cerrarlo.
              </AlertDescription>
            </Alert>
          ) : null}

          <RenewalForm
            parentId={contract.id}
            parentCode={contract.code}
            parentCostLabel={formatMoney(
              contract.costMinorPerContent,
              contract.costCurrency
            )}
            fxRates={fxRates}
            campaigns={campaigns.map((campaign) => ({
              id: campaign.id,
              name: campaign.name,
              clientName: campaign.client?.name ?? null,
              settlementLabel:
                SETTLEMENT_MODE_LABELS[
                  campaign.client?.settlementMode as SettlementMode
                ] ?? "Por contenido",
            }))}
            defaults={{
              deliverableCount: contract.deliverableCount,
              salePricePerContent: String(
                fromMinorUnits(contract.salePriceCentsPerContent, "USD")
              ),
              costCurrency: contract.costCurrency,
              costPerContent: String(
                fromMinorUnits(
                  contract.costMinorPerContent,
                  contract.costCurrency
                )
              ),
              paymentTermDays: contract.paymentTermDays,
            }}
          />
        </>
      )}
    </main>
  );
}
