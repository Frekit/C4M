import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import type { Metadata } from "next";
import { LandmarkIcon, LayersIcon, WalletIcon } from "lucide-react";

import { QueryPager } from "@/components/query-pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { FINANCE_PAGE_SIZE } from "@/lib/domain/enums";
import { loadFinanceQueues } from "@/lib/domain/finance";
import { queryHref } from "@/lib/domain/paging";
import { redirect } from "next/navigation";

import { CampaignQueue } from "./campaign-queue";
import { PackQueue } from "./pack-queue";
import { PlatformErrorQueue } from "./platform-error-queue";
import { PayoutQueue } from "./payout-queue";
import { RecentPaid } from "./recent-paid";

export const metadata: Metadata = {
  title: "Finanzas",
};

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ campana?: string; pagina?: string }>;
}) {
  const user = await requireUser("/finanzas");
  if (!can(user.role, "finance:manage")) {
    redirect("/");
  }

  const filters = await searchParams;
  const queues = await loadFinanceQueues(filters);
  const canSeeFull = can(user.role, "payees:read_full");
  const hrefForPage = (page: number) =>
    queryHref("/finanzas", { campana: filters.campana }, page);

  return (
    <PageShell width="wide">
      <div className="space-y-1">
        <h1 className="text-heading-24">
          Finanzas
        </h1>
        <p className="text-sm text-muted-foreground">
          Trabaja por campaña y por lote de {FINANCE_PAGE_SIZE}. Copia o
          descarga las URLs de la página y márcalas en plataforma.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Campaña
          <select
            name="campana"
            defaultValue={filters.campana ?? ""}
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
          >
            <option value="">Todas (resumen)</option>
            {queues.platformSummaries.map((item) => (
              <option key={item.campaignId} value={item.campaignId}>
                {item.campaignName}
                {item.clientName ? ` · ${item.clientName}` : ""} ({item.count})
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm">
          Filtrar
        </Button>
      </form>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          Por subir al cliente: {queues.readyToUploadCount}
        </Badge>
        <Badge variant="outline">Packs listos: {queues.readyPacks}</Badge>
        <Badge variant="secondary">
          Listos para pagar: {queues.payableCount}
        </Badge>
        {queues.platformErrorCount > 0 ? (
          <Badge variant="destructive">
            Error al subir: {queues.platformErrorCount}
          </Badge>
        ) : null}
        {queues.missingLinkCount > 0 ? (
          <Badge variant="destructive">
            Publicados sin enlace: {queues.missingLinkCount}
          </Badge>
        ) : null}
      </div>

      {!filters.campana && queues.platformSummaries.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Campañas con cola de plataforma</CardTitle>
            <CardDescription>
              Entra a una para paginar, copiar URLs y marcar el lote.
            </CardDescription>
          </CardHeader>
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            {queues.platformSummaries.map((item) => (
              <Button
                key={item.campaignId}
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link href={`/finanzas?campana=${item.campaignId}`} />
                }
              >
                {item.campaignName} ({item.count})
              </Button>
            ))}
          </div>
        </Card>
      ) : null}

      <Tabs defaultValue="cliente">
        <TabsList>
          <TabsTrigger value="cliente">
            <LandmarkIcon />
            Plataforma
          </TabsTrigger>
          <TabsTrigger value="packs">
            <LayersIcon />
            Packs
          </TabsTrigger>
          <TabsTrigger value="pagos">
            <WalletIcon />
            Lote Zexel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cliente" className="grid gap-4 pt-4">
          {queues.missingLinkCount > 0 ? (
            <p className="text-sm text-destructive">
              Hay {queues.missingLinkCount} publicados sin enlace.
              {filters.campana ? (
                <>
                  {" "}
                  <Link
                    href={`/contenidos?campana=${filters.campana}&sinEnlace=1`}
                    className="underline underline-offset-4"
                  >
                    Abrir en Contenidos
                  </Link>
                </>
              ) : (
                " Filtra una campaña para verlos."
              )}
            </p>
          ) : null}
          {queues.platformGroups.length === 0 &&
          queues.platformErrorGroups.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Nada pendiente de subir</CardTitle>
                <CardDescription>
                  Cuando un contenido de un cliente con plataforma pase a
                  Publicado y tenga enlace, aparece aquí. Elige una campaña si
                  hay varias colas.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <CampaignQueue groups={queues.platformGroups} />
              <QueryPager
                page={queues.page}
                pageSize={queues.pageSize}
                total={queues.platformGroups[0]?.total ?? 0}
                hrefForPage={hrefForPage}
                noun="contenidos listos"
              />
              <PlatformErrorQueue groups={queues.platformErrorGroups} />
            </>
          )}
        </TabsContent>

        <TabsContent value="packs" className="grid gap-4 pt-4">
          <PackQueue groups={queues.packGroups} />
          <QueryPager
            page={queues.packPage}
            pageSize={queues.pageSize}
            total={queues.packTotal}
            hrefForPage={hrefForPage}
            noun="packs"
          />
        </TabsContent>

        <TabsContent value="pagos" className="grid gap-4 pt-4">
          {canSeeFull ? (
            <>
              <PayoutQueue groups={queues.payoutGroups} />
              <QueryPager
                page={queues.page}
                pageSize={queues.pageSize}
                total={queues.payoutTotal}
                hrefForPage={hrefForPage}
                noun="perfiles a pagar"
              />
              <RecentPaid items={queues.recentPaid} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu rol no ve las cuentas completas.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
