import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandmarkIcon, LayersIcon, WalletIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { loadFinanceQueues } from "@/lib/domain/finance";

import { CampaignQueue } from "./campaign-queue";
import { PackQueue } from "./pack-queue";
import { PlatformErrorQueue } from "./platform-error-queue";
import { PayoutQueue } from "./payout-queue";
import { RecentPaid } from "./recent-paid";

export const metadata: Metadata = {
  title: "Finanzas",
};

export default async function FinanzasPage() {
  const user = await requireUser("/finanzas");
  if (!can(user.role, "finance:manage")) {
    redirect("/");
  }

  const queues = await loadFinanceQueues();
  const canSeeFull = can(user.role, "payees:read_full");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Finanzas
        </h1>
        <p className="text-sm text-muted-foreground">
          Higgsfield: sube los publicados a la plataforma. Many Chat y
          similares: espera a que el perfil cierre el pack. El cobro a
          perfiles sale en un lote de Zexel (CSV con email, importe y moneda).
        </p>
      </div>

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
        {queues.missingLink.length > 0 ? (
          <Badge variant="destructive">
            Publicados sin enlace: {queues.missingLink.length}
          </Badge>
        ) : null}
      </div>

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
          {queues.missingLink.length > 0 ? (
            <p className="text-sm text-destructive">
              Hay {queues.missingLink.length}{" "}
              {queues.missingLink.length === 1
                ? "contenido publicado sin enlace"
                : "contenidos publicados sin enlace"}
              . Hasta que Contents ponga la URL no se pueden subir al cliente:{" "}
              {queues.missingLink
                .map(
                  (item) =>
                    `@${item.creatorHandle} ${item.contractCode} nº ${item.position}`
                )
                .join(" · ")}
            </p>
          ) : null}
          {queues.platformGroups.length === 0 &&
          queues.platformErrorGroups.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Nada pendiente de subir</CardTitle>
                <CardDescription>
                  Cuando un contenido de un cliente con plataforma pase a
                  Publicado y tenga enlace, aparece aquí agrupado por campaña.
                  Si Higgsfield lo rechaza, márcalo con la razón y sale a
                  revisar.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <>
              <CampaignQueue groups={queues.platformGroups} />
              <PlatformErrorQueue groups={queues.platformErrorGroups} />
            </>
          )}
        </TabsContent>

        <TabsContent value="packs" className="grid gap-4 pt-4">
          <PackQueue groups={queues.packGroups} />
        </TabsContent>

        <TabsContent value="pagos" className="grid gap-4 pt-4">
          {canSeeFull ? (
            <>
              <PayoutQueue groups={queues.payoutGroups} />
              <RecentPaid items={queues.recentPaid} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu rol no ve las cuentas completas.
            </p>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}
