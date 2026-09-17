import Link from "next/link";
import { CalendarClockIcon, PenLineIcon, PlusIcon } from "lucide-react";

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
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { contractTotals, deliverableProgress } from "@/lib/domain/contract-math";
import { CONTRACT_STATUS, DELIVERABLE_STATUS, SETTLEMENT_MODE } from "@/lib/domain/enums";
import { loadPackCampaignIds, loadPackSummaries } from "@/lib/domain/pack-sync";
import { isAccruedDeliverable, packKey, settlementPolicyOf } from "@/lib/domain/settlement";
import { formatDate, relativeDueLabel } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export default async function DashboardPage() {
  const user = await requireUser("/");

  const packCampaignIds = await loadPackCampaignIds();
  const [creatorCount, contracts, upcomingPayments, packs] = await Promise.all([
    prisma.creator.count(),
    prisma.contract.findMany({
      include: {
        creator: true,
        client: true,
        deliverables: { include: { campaign: { include: { client: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.deliverable.findMany({
      where: {
        paymentDueAt: { not: null },
        OR: [
          { status: DELIVERABLE_STATUS.SUBMITTED },
          {
            status: DELIVERABLE_STATUS.PUBLISHED,
            campaignId: { in: packCampaignIds },
          },
        ],
      },
      orderBy: { paymentDueAt: "asc" },
      take: 8,
      include: { contract: { include: { creator: true } } },
    }),
    loadPackSummaries(),
  ]);

  const live = contracts.filter(
    (contract) => contract.status !== CONTRACT_STATUS.CANCELLED
  );

  const allDeliverables = live.flatMap((contract) => contract.deliverables);
  const progress = deliverableProgress(allDeliverables);

  const marginUsdCents = live.reduce(
    (total, contract) => total + contractTotals(contract).marginTotalUsdCents,
    0
  );

  const accruedByCurrency = live.reduce<Record<string, number>>(
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

  const awaitingSignature = live.filter(
    (contract) =>
      contract.status === CONTRACT_STATUS.DRAFT ||
      contract.status === CONTRACT_STATUS.SENT
  );

  if (creatorCount === 0) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-12 sm:px-6">
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            Empecemos por el primer influencer
          </h1>
          <p className="text-sm text-muted-foreground">
            Registra a quien vayas a contratar con su enlace de Instagram, los
            contenidos pactados y los precios. La app crea el contrato, te da un
            enlace de firma para el talento o su agencia y, con sus datos ya
            dentro, va calculando qué se le debe y cuándo toca pagarle.
          </p>
        </div>
        {can(user.role, "creators:write") ? (
          <Button
            className="w-fit"
            size="lg"
            nativeButton={false}
            render={<Link href="/creators/nuevo" />}
          >
            <PlusIcon />
            Registrar influencer
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tu rol no permite registrar creators. Pide a Gestión de creators que
            dé de alta el primero.
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            Panel
          </h1>
          <p className="text-sm text-muted-foreground">
            Estado de lo contratado con creators.
          </p>
        </div>
        {can(user.role, "creators:write") ? (
          <Button nativeButton={false} render={<Link href="/creators/nuevo" />}>
            <PlusIcon />
            Registrar influencer
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Creators</CardDescription>
            <CardTitle className="text-2xl">{creatorCount}</CardTitle>
          </CardHeader>
        </Card>
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
            <CardDescription>Devengado a creators</CardDescription>
            <CardTitle className="text-2xl">
              {Object.keys(accruedByCurrency).length === 0
                ? formatMoney(0, "USD")
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
            <CardDescription>Margen previsto</CardDescription>
            <CardTitle
              className={marginUsdCents < 0 ? "text-2xl text-destructive" : "text-2xl"}
            >
              {formatMoney(marginUsdCents, "USD")}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <PenLineIcon className="size-4 text-muted-foreground" />
            <CardTitle>Pendiente de firma ({awaitingSignature.length})</CardTitle>
            <CardDescription>
              Contratos en borrador o enviados. Se puede marcar un post como
              publicado igualmente; la firma sigue pendiente.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {awaitingSignature.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nada pendiente. Todos los contratos vivos están firmados.
              </p>
            ) : (
              awaitingSignature.slice(0, 6).map((contract) => (
                <Link
                  key={contract.id}
                  href={`/contratos/${contract.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      @{contract.creator.handle}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {contract.code}
                    </p>
                  </div>
                  <ContractStatusBadge status={contract.status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CalendarClockIcon className="size-4 text-muted-foreground" />
            <CardTitle>Próximos pagos</CardTitle>
            <CardDescription>
              Higgsfield: cuando Finanzas los marca submitted. Packs: cuando
              ese perfil cierra la campaña. La fecha sale de la publicación +
              plazo (en packs, de la última pieza).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {upcomingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay pagos a perfiles. En plataforma hace falta el
                submitted; en packs, que el perfil termine la campaña.
              </p>
            ) : (
              upcomingPayments.map((item) => {
                const overdue =
                  item.paymentDueAt !== null && item.paymentDueAt < new Date();

                return (
                  <Link
                    key={item.id}
                    href={`/contratos/${item.contractId}`}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        @{item.contract.creator.handle}
                        <span className="ml-2 text-xs text-muted-foreground">
                          contenido {item.position}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.paymentDueAt)} ·{" "}
                        {relativeDueLabel(item.paymentDueAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-sm font-medium">
                        {formatMoney(
                          item.contract.costMinorPerContent,
                          item.contract.costCurrency
                        )}
                      </span>
                      {overdue ? (
                        <Badge variant="destructive">Vencido</Badge>
                      ) : null}
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
