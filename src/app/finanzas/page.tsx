import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandmarkIcon, LayersIcon, WalletIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { loadFinanceQueues } from "@/lib/domain/finance";

import { CampaignQueue } from "./campaign-queue";
import { PackQueue } from "./pack-queue";
import { PayoutQueue } from "./payout-queue";

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
          Higgsfield: sube los publicados a la plataforma y luego paga. Many
          Chat y similares: se cobra y se paga cuando el perfil cierra el pack
          de esa campaña.
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
            Pagar perfiles
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
          <CampaignQueue groups={queues.platformGroups} />
        </TabsContent>

        <TabsContent value="packs" className="grid gap-4 pt-4">
          <PackQueue groups={queues.packGroups} />
        </TabsContent>

        <TabsContent value="pagos" className="grid gap-4 pt-4">
          {canSeeFull ? (
            <PayoutQueue groups={queues.payoutGroups} />
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
