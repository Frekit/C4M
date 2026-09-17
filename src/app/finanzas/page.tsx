import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandmarkIcon, WalletIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
  SIGNATURE_STATUS,
} from "@/lib/domain/enums";

import { CampaignQueue, type CampaignQueueGroup } from "./campaign-queue";
import { PayoutQueue, type PayoutGroup } from "./payout-queue";

export const metadata: Metadata = {
  title: "Finanzas",
};

export default async function FinanzasPage() {
  const user = await requireUser("/finanzas");
  if (!can(user.role, "finance:manage")) {
    redirect("/");
  }

  const [toUpload, payable] = await Promise.all([
    prisma.deliverable.findMany({
      where: {
        status: DELIVERABLE_STATUS.PUBLISHED,
        contract: { status: { not: CONTRACT_STATUS.CANCELLED } },
      },
      include: {
        campaign: true,
        contract: { include: { creator: true } },
      },
      orderBy: [{ publishedAt: "asc" }, { position: "asc" }],
    }),
    prisma.deliverable.findMany({
      where: {
        status: DELIVERABLE_STATUS.SUBMITTED,
        contract: { status: { not: CONTRACT_STATUS.CANCELLED } },
      },
      include: {
        contract: {
          include: {
            creator: true,
            signatureRequests: { include: { payee: true } },
          },
        },
      },
      orderBy: [{ paymentDueAt: "asc" }, { position: "asc" }],
    }),
  ]);

  const readyToUpload = toUpload.filter((item) => Boolean(item.postUrl));
  const missingLink = toUpload.filter((item) => !item.postUrl);

  const campaignGroups = new Map<string, CampaignQueueGroup>();
  for (const item of readyToUpload) {
    const key = item.campaignId ?? "sin";
    const existing = campaignGroups.get(key);
    const row = {
      id: item.id,
      position: item.position,
      postUrl: item.postUrl as string,
      publishedAt: item.publishedAt?.toISOString() ?? null,
      creatorHandle: item.contract.creator.handle,
      contractCode: item.contract.code,
      contractId: item.contractId,
      costMinor: item.contract.costMinorPerContent,
      costCurrency: item.contract.costCurrency,
    };

    if (existing) {
      existing.items.push(row);
    } else {
      campaignGroups.set(key, {
        key,
        campaignId: item.campaignId,
        campaignName: item.campaign?.name ?? "Sin campaña",
        clientName: item.campaign?.clientName ?? null,
        items: [row],
      });
    }
  }

  const payoutGroups = new Map<string, PayoutGroup>();
  for (const item of payable) {
    const creator = item.contract.creator;
    const signed = item.contract.signatureRequests.find(
      (request) => request.status === SIGNATURE_STATUS.SIGNED
    );
    const payee = signed?.payee ?? null;
    const existing = payoutGroups.get(creator.id);
    const row = {
      id: item.id,
      position: item.position,
      postUrl: item.postUrl,
      paymentDueAt: item.paymentDueAt?.toISOString() ?? null,
      clientSubmittedAt: item.clientSubmittedAt?.toISOString() ?? null,
      costMinor: item.contract.costMinorPerContent,
      costCurrency: item.contract.costCurrency,
      creatorHandle: creator.handle,
      contractCode: item.contract.code,
      contractId: item.contractId,
    };

    if (existing) {
      existing.items.push(row);
    } else {
      payoutGroups.set(creator.id, {
        creatorId: creator.id,
        creatorHandle: creator.handle,
        payeeName: payee?.legalName ?? null,
        payoutMethod: payee?.payoutMethod ?? null,
        account:
          payee?.payoutMethod === "WISE"
            ? (payee.wiseEmail ?? null)
            : (payee?.iban ?? null),
        payoutCurrency: payee?.payoutCurrency ?? null,
        items: [row],
      });
    }
  }

  const canSeeFull = can(user.role, "payees:read_full");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Finanzas
        </h1>
        <p className="text-sm text-muted-foreground">
          Coge los enlaces publicados, súbelos a la plataforma del cliente y
          márcalos como submitted. Ahí es cuando se puede pagar a los perfiles.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          Por subir al cliente: {readyToUpload.length}
        </Badge>
        <Badge variant="secondary">Listos para pagar: {payable.length}</Badge>
        {missingLink.length > 0 ? (
          <Badge variant="destructive">
            Publicados sin enlace: {missingLink.length}
          </Badge>
        ) : null}
      </div>

      <Tabs defaultValue="cliente">
        <TabsList>
          <TabsTrigger value="cliente">
            <LandmarkIcon />
            Plataforma del cliente
          </TabsTrigger>
          <TabsTrigger value="pagos">
            <WalletIcon />
            Pagar perfiles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cliente" className="grid gap-4 pt-4">
          {missingLink.length > 0 ? (
            <p className="text-sm text-destructive">
              Hay {missingLink.length}{" "}
              {missingLink.length === 1
                ? "contenido publicado sin enlace"
                : "contenidos publicados sin enlace"}
              . Hasta que Contents ponga la URL no se pueden subir al cliente:{" "}
              {missingLink
                .map(
                  (item) =>
                    `@${item.contract.creator.handle} ${item.contract.code} nº ${item.position}`
                )
                .join(" · ")}
            </p>
          ) : null}
          <CampaignQueue groups={[...campaignGroups.values()]} />
        </TabsContent>

        <TabsContent value="pagos" className="grid gap-4 pt-4">
          {canSeeFull ? (
            <PayoutQueue groups={[...payoutGroups.values()]} />
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
