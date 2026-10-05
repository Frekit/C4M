import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { CalendarClockIcon, PenLineIcon, PlusIcon } from "lucide-react";

import { ContractStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { loadDashboard } from "@/lib/domain/dashboard";
import { formatMedianViews } from "@/lib/domain/median-views";
import { formatDate, relativeDueLabel } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export default async function DashboardPage() {
  const user = await requireUser("/");
  const {
    creatorCount,
    progress,
    marginUsdCents,
    accruedByCurrency,
    awaitingSignature,
    awaitingSignatureCount,
    upcomingPayments,
    opsAlerts,
    medianViewsDue,
    medianViewsDueCount,
  } = await loadDashboard();

  if (creatorCount === 0) {
    return (
      <PageShell width="narrow" className="justify-center py-16">
        <div className="space-y-2">
          <h1 className="text-heading-24">
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
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-heading-24">
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

      {opsAlerts.expiredCount > 0 ||
      opsAlerts.unsignedPublishedCount > 0 ||
      opsAlerts.missingLinkCount > 0 ||
      opsAlerts.platformErrorCount > 0 ||
      medianViewsDueCount > 0 ? (
        <div className="grid gap-3">
          {opsAlerts.expiredCount > 0 ? (
            <Alert>
              <AlertTitle>
                Firma caducada ({opsAlerts.expiredCount})
              </AlertTitle>
              <AlertDescription>
                <Link
                  href="/contratos?estado=SENT"
                  className="underline underline-offset-4"
                >
                  Abrir cola de contratos enviados
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}
          {opsAlerts.unsignedPublishedCount > 0 ? (
            <Alert>
              <AlertTitle>
                Publicado sin firmar ({opsAlerts.unsignedPublishedCount})
              </AlertTitle>
              <AlertDescription>
                <Link
                  href="/contenidos?sinFirmar=1"
                  className="underline underline-offset-4"
                >
                  Ver en Contenidos
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}
          {opsAlerts.missingLinkCount > 0 ? (
            <Alert>
              <AlertTitle>
                Publicados sin enlace ({opsAlerts.missingLinkCount})
              </AlertTitle>
              <AlertDescription>
                <Link
                  href="/contenidos?sinEnlace=1"
                  className="underline underline-offset-4"
                >
                  Completar URLs
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}
          {opsAlerts.platformErrorCount > 0 ? (
            <Alert>
              <AlertTitle>
                Error de plataforma ({opsAlerts.platformErrorCount})
              </AlertTitle>
              <AlertDescription>
                <Link
                  href="/contenidos?errorPlataforma=1"
                  className="underline underline-offset-4"
                >
                  Revisar en Contenidos
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}
          {medianViewsDueCount > 0 ? (
            <Alert>
              <AlertTitle>
                Mediana de views por actualizar ({medianViewsDueCount})
              </AlertTitle>
              <AlertDescription>
                <span className="block">
                  A los 15 días de anotarla hay que volver a mirar Instagram.
                </span>
                <span className="mt-2 flex flex-col gap-1">
                  {medianViewsDue.map((creator) => (
                    <Link
                      key={creator.id}
                      href={`/creators/${creator.id}`}
                      className="underline underline-offset-4"
                    >
                      @{creator.handle}
                      {creator.igMedianViews != null
                        ? ` · ${formatMedianViews(creator.igMedianViews)} views`
                        : " · sin mediana"}
                      {creator.igMedianViewsAt
                        ? ` · registrada el ${formatDate(creator.igMedianViewsAt)}`
                        : ""}
                    </Link>
                  ))}
                </span>
                <Link
                  href="/creators?views=pendientes"
                  className="mt-2 inline-block underline underline-offset-4"
                >
                  Ver todas
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}
          {opsAlerts.items.slice(0, 4).map((alert) => (
            <Alert key={`${alert.kind}-${alert.contractId}`}>
              <AlertTitle>
                {alert.kind === "expired_signature"
                  ? "Enlace de firma caducado"
                  : "Publicado sin contrato firmado"}
              </AlertTitle>
              <AlertDescription>
                <Link
                  href={`/contratos/${alert.contractId}`}
                  className="hover:underline"
                >
                  @{alert.handle} · {alert.code}
                </Link>
                {alert.kind === "expired_signature"
                  ? " — genera un enlace nuevo."
                  : ` — ${alert.publishedCount} contenido(s) en redes y la firma sigue pendiente.`}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}

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
            <CardTitle>Pendiente de firma ({awaitingSignatureCount})</CardTitle>
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
              awaitingSignature.map((contract) => (
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
              Higgsfield: cuando Finanzas los marca en plataforma. Packs:
              cuando ese perfil cierra la campaña. La fecha sale de la
              publicación más el plazo (en packs, de la última pieza).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {upcomingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay pagos a perfiles. En plataforma hace falta
                marcarlos como enviados; en packs, que el perfil termine la
                campaña.
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
    </PageShell>
  );
}
