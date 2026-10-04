import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLinkIcon, PlusIcon } from "lucide-react";

import { ContractChain } from "@/components/contract-chain";
import { CreatorPaymentHistory } from "@/components/creator-payment-history";
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
import { Progress } from "@/components/ui/progress";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { loadCreatorPresence } from "@/lib/domain/campaign-talent";
import { labelForSlug, loadRosterCatalog } from "@/lib/domain/roster-catalog";
import { prisma } from "@/lib/db";
import { deliverableProgress } from "@/lib/domain/contract-math";
import {
  CAMPAIGN_TALENT_STATUS_LABELS,
  CONTRACT_STATUS,
  SETTLEMENT_MODE,
  SETTLEMENT_MODE_LABELS,
  type SettlementMode,
} from "@/lib/domain/enums";
import { loadPackSummaries } from "@/lib/domain/pack-sync";
import {
  creatorPaymentRows,
  sumPaymentsByCurrency,
} from "@/lib/domain/creator-payments";
import {
  isAccruedDeliverable,
  packKey,
  settlementPolicyOf,
} from "@/lib/domain/settlement";
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
          client: true,
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

  const [presence, catalog] = await Promise.all([
    loadCreatorPresence(creator.id),
    loadRosterCatalog(),
  ]);
  const packs = await loadPackSummaries();
  const allDeliverables = creator.contracts.flatMap(
    (contract) => contract.deliverables
  );
  const progress = deliverableProgress(allDeliverables);

  const accruedByCurrency = creator.contracts.reduce<Record<string, number>>(
    (accumulator, contract) => {
      for (const item of contract.deliverables) {
        const policy = settlementPolicyOf({
          client: contract.client,
          campaign: item.campaign,
        });
        const pack =
          item.campaignId && policy?.settlementMode === SETTLEMENT_MODE.PACK
            ? packs.get(packKey(item.campaignId, contract.creatorId))
            : null;
        if (isAccruedDeliverable(item.status, policy, pack?.isComplete ?? false)) {
          accumulator[contract.costCurrency] =
            (accumulator[contract.costCurrency] ?? 0) +
            contract.costMinorPerContent;
        }
      }
      return accumulator;
    },
    {}
  );

  const groups = new Map<
    string,
    {
      clientId: string | null;
      name: string;
      settlementMode: string | null;
      requiresPlatformSubmit: boolean;
      contracts: typeof creator.contracts;
    }
  >();

  for (const contract of creator.contracts) {
    const key = contract.clientId ?? "sin";
    const existing = groups.get(key);
    if (existing) {
      existing.contracts.push(contract);
    } else {
      groups.set(key, {
        clientId: contract.clientId,
        name: contract.client?.name ?? "Sin cliente",
        settlementMode: contract.client?.settlementMode ?? null,
        requiresPlatformSubmit: contract.client?.requiresPlatformSubmit ?? false,
        contracts: [contract],
      });
    }
  }

  const payments = creatorPaymentRows(
    allDeliverables.map((item) => {
      const contract = creator.contracts.find(
        (entry) => entry.id === item.contractId
      );
      return {
        id: item.id,
        position: item.position,
        paidAt: item.paidAt,
        paidByEmail: item.paidByEmail,
        paidMinor: item.paidMinor,
        paidCurrency: item.paidCurrency,
        postUrl: item.postUrl,
        costMinor: contract?.costMinorPerContent ?? 0,
        costCurrency: contract?.costCurrency ?? creator.payoutCurrency,
        contractId: item.contractId,
        contractCode: contract?.code ?? "—",
        campaignName: item.campaign?.name ?? null,
        clientName: item.campaign?.client?.name ?? contract?.client?.name ?? null,
      };
    })
  );
  const paidByCurrency = sumPaymentsByCurrency(payments);

  const canRenew = can(user.role, "contracts:renew");
  const canAddClient = can(user.role, "contracts:write");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            @{creator.handle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {creator.displayName ?? "Sin nombre registrado"}
            {labelForSlug(catalog.countries, creator.country)
              ? ` · ${labelForSlug(catalog.countries, creator.country)}`
              : ""}
            {labelForSlug(catalog.profileTypes, creator.profileType)
              ? ` · ${labelForSlug(catalog.profileTypes, creator.profileType)}`
              : ""}
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
          {canAddClient ? (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href={`/creators/${creator.id}/cliente`} />}
            >
              <PlusIcon />
              Meter con otro cliente
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <CardDescription>Pagado (Zexel)</CardDescription>
            <CardTitle className="text-2xl">
              {Object.keys(paidByCurrency).length === 0
                ? formatMoney(0, creator.payoutCurrency)
                : Object.entries(paidByCurrency).map(([currency, amount]) => (
                    <span key={currency} className="block">
                      {formatMoney(amount, currency)}
                    </span>
                  ))}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Clientes</CardDescription>
            <CardTitle className="text-2xl">{groups.size}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Visibilidad entre campañas</CardTitle>
          <CardDescription>
            Si este perfil está en otra campaña, se ve aquí antes de proponerlo
            a un cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {presence.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Libre: no está asignado a ninguna campaña.
            </p>
          ) : (
            <ul className="grid gap-2">
              {presence.map((item) => (
                <li
                  key={item.campaignId}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <Link
                    href={`/campanas/${item.campaignId}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {item.campaignName}
                  </Link>
                  <Badge variant="outline">
                    {CAMPAIGN_TALENT_STATUS_LABELS[item.talentStatus]}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {[...groups.values()].map((group) => {
        const deliverables = group.contracts.flatMap(
          (contract) => contract.deliverables
        );
        const groupProgress = deliverableProgress(deliverables);
        const live = [...group.contracts]
          .reverse()
          .find((contract) => contract.status !== CONTRACT_STATUS.CANCELLED);

        return (
          <Card key={group.clientId ?? "sin"}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{group.name}</CardTitle>
                    {group.settlementMode ? (
                      <Badge variant="outline">
                        {
                          SETTLEMENT_MODE_LABELS[
                            group.settlementMode as SettlementMode
                          ]
                        }
                      </Badge>
                    ) : null}
                    {group.requiresPlatformSubmit ? (
                      <Badge variant="secondary">Plataforma</Badge>
                    ) : null}
                  </div>
                  <CardDescription>
                    {groupProgress.published}/{groupProgress.total} publicados
                    {live ? ` · ${live.code}` : ""}
                    {" · alta "}
                    {formatDate(group.contracts[0]?.createdAt)}
                  </CardDescription>
                </div>
                {canRenew && live ? (
                  <Button
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/contratos/${live.id}/renovar`} />}
                  >
                    Ampliar o renovar
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Progress
                value={groupProgress.ratio * 100}
                className="h-1.5"
              />
              <ContractChain chain={group.contracts} />
            </CardContent>
          </Card>
        );
      })}

      <CreatorPaymentHistory rows={payments} />

      <PayeeCard
        payee={creator.payees[0] ?? null}
        canSeeFullAccount={can(user.role, "payees:read_full")}
      />
    </main>
  );
}
