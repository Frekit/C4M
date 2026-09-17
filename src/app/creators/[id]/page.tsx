import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLinkIcon } from "lucide-react";

import { ContractChain } from "@/components/contract-chain";
import { PayeeCard } from "@/components/payee-card";
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
import { prisma } from "@/lib/db";
import { deliverableProgress } from "@/lib/domain/contract-math";
import { CONTRACT_STATUS, SETTLEMENT_MODE } from "@/lib/domain/enums";
import { loadPackSummaries } from "@/lib/domain/pack-sync";
import { isAccruedDeliverable, packKey } from "@/lib/domain/settlement";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Ficha del creator",
};

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/creators/${id}`);

  const creator = await prisma.creator.findUnique({
    where: { id },
    include: {
      contracts: {
        include: {
          deliverables: { include: { campaign: { include: { client: true } } } },
          signatureRequests: true,
        },
        orderBy: { createdAt: "asc" },
      },
      payees: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!creator) {
    notFound();
  }

  const packs = await loadPackSummaries();
  const allDeliverables = creator.contracts.flatMap(
    (contract) => contract.deliverables
  );
  const progress = deliverableProgress(allDeliverables);

  const accruedByCurrency = creator.contracts.reduce<Record<string, number>>(
    (accumulator, contract) => {
      for (const item of contract.deliverables) {
        const pack =
          item.campaignId &&
          item.campaign?.client?.settlementMode === SETTLEMENT_MODE.PACK
            ? packs.get(packKey(item.campaignId, contract.creatorId))
            : null;
        if (
          isAccruedDeliverable(
            item.status,
            item.campaign?.client ?? null,
            pack?.isComplete ?? false
          )
        ) {
          accumulator[contract.costCurrency] =
            (accumulator[contract.costCurrency] ?? 0) +
            contract.costMinorPerContent;
        }
      }
      return accumulator;
    },
    {}
  );

  const openContract = creator.contracts.find(
    (contract) =>
      contract.status === CONTRACT_STATUS.DRAFT ||
      contract.status === CONTRACT_STATUS.SENT ||
      contract.status === CONTRACT_STATUS.SIGNED
  );

  const lastContract = creator.contracts[creator.contracts.length - 1];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            @{creator.handle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {creator.displayName ?? "Sin nombre registrado"}
            {creator.contactEmail ? ` · ${creator.contactEmail}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a
                href={creator.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <ExternalLinkIcon />
            Instagram
          </Button>
          {can(user.role, "contracts:renew") && lastContract ? (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href={`/contratos/${lastContract.id}/renovar`} />}
            >
              Ampliar o renovar
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Contenidos entregados</CardDescription>
            <CardTitle className="text-2xl">
              {progress.published}
              <span className="text-base text-muted-foreground">
                /{progress.total}
              </span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Devengado a su favor</CardDescription>
            <CardTitle className="text-2xl">
              {Object.keys(accruedByCurrency).length === 0
                ? formatMoney(0, creator.payoutCurrency)
                : Object.entries(accruedByCurrency).map(([currency, amount]) => (
                    <span key={currency} className="block">
                      {formatMoney(amount, currency)}
                    </span>
                  ))}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Contratos</CardDescription>
            <CardTitle className="text-2xl">{creator.contracts.length}</CardTitle>
          </CardHeader>
          <CardContent>
            {openContract ? (
              <Badge variant="secondary">
                {openContract.code} en curso
              </Badge>
            ) : (
              <Badge variant="outline">Ninguno en curso</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cadena de contratos</CardTitle>
          <CardDescription>
            Del primero al último, con lo entregado en cada uno. Alta el{" "}
            {formatDate(creator.createdAt)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContractChain chain={creator.contracts} />
        </CardContent>
      </Card>

      <PayeeCard
        payee={creator.payees[0] ?? null}
        canSeeFullAccount={can(user.role, "payees:read_full")}
      />
    </main>
  );
}
