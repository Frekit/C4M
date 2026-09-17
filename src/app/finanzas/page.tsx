import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LandmarkIcon, LayersIcon, WalletIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
  SETTLEMENT_MODE,
  SIGNATURE_STATUS,
} from "@/lib/domain/enums";
import { isLiveDeliverable } from "@/lib/domain/rules";
import { packKey, packProgress } from "@/lib/domain/settlement";

import { CampaignQueue, type CampaignQueueGroup } from "./campaign-queue";
import { PackQueue, type PackQueueGroup } from "./pack-queue";
import { PayoutQueue, type PayoutGroup } from "./payout-queue";

export const metadata: Metadata = {
  title: "Finanzas",
};

export default async function FinanzasPage() {
  const user = await requireUser("/finanzas");
  if (!can(user.role, "finance:manage")) {
    redirect("/");
  }

  const live = await prisma.deliverable.findMany({
    where: {
      contract: { status: { not: CONTRACT_STATUS.CANCELLED } },
    },
    include: {
      campaign: { include: { client: true } },
      contract: {
        include: {
          creator: true,
          signatureRequests: { include: { payee: true } },
        },
      },
    },
    orderBy: [{ publishedAt: "asc" }, { position: "asc" }],
  });

  const toUpload = live.filter(
    (item) =>
      item.status === DELIVERABLE_STATUS.PUBLISHED &&
      item.campaign?.client?.requiresPlatformSubmit === true
  );
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
        clientName: item.campaign?.client?.name ?? null,
        items: [row],
      });
    }
  }

  const packBuckets = new Map<
    string,
    {
      campaignId: string;
      campaignName: string;
      clientName: string;
      creatorId: string;
      creatorHandle: string;
      items: typeof live;
    }
  >();

  for (const item of live) {
    if (
      !item.campaignId ||
      item.campaign?.client?.settlementMode !== SETTLEMENT_MODE.PACK
    ) {
      continue;
    }

    const key = packKey(item.campaignId, item.contract.creatorId);
    const existing = packBuckets.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      packBuckets.set(key, {
        campaignId: item.campaignId,
        campaignName: item.campaign?.name ?? "Campaña",
        clientName: item.campaign?.client?.name ?? "Cliente",
        creatorId: item.contract.creatorId,
        creatorHandle: item.contract.creator.handle,
        items: [item],
      });
    }
  }

  const packGroups: PackQueueGroup[] = [...packBuckets.values()].map(
    (bucket) => {
      const progress = packProgress(bucket.items);
      return {
        key: packKey(bucket.campaignId, bucket.creatorId),
        campaignId: bucket.campaignId,
        campaignName: bucket.campaignName,
        clientName: bucket.clientName,
        creatorId: bucket.creatorId,
        creatorHandle: bucket.creatorHandle,
        published: progress.published,
        total: progress.total,
        isComplete: progress.isComplete,
        paymentDueAt:
          bucket.items.find((item) => item.paymentDueAt)?.paymentDueAt?.toISOString() ??
          null,
        items: bucket.items.map((item) => ({
          id: item.id,
          position: item.position,
          status: item.status,
          postUrl: item.postUrl,
          publishedAt: item.publishedAt?.toISOString() ?? null,
          costMinor: item.contract.costMinorPerContent,
          costCurrency: item.contract.costCurrency,
        })),
      };
    }
  );

  const payableItems = live.filter((item) => {
    if (!isLiveDeliverable(item.status)) return false;
    const policy = item.campaign?.client ?? null;
    if (policy?.settlementMode === SETTLEMENT_MODE.PACK) {
      if (!item.campaignId) return false;
      const key = packKey(item.campaignId, item.contract.creatorId);
      return packGroups.find((group) => group.key === key)?.isComplete === true;
    }
    return item.status === DELIVERABLE_STATUS.SUBMITTED;
  });

  const payoutGroups = new Map<string, PayoutGroup>();
  for (const item of payableItems) {
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
  const readyPacks = packGroups.filter((group) => group.isComplete).length;

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
          Por subir al cliente: {readyToUpload.length}
        </Badge>
        <Badge variant="outline">Packs listos: {readyPacks}</Badge>
        <Badge variant="secondary">Listos para pagar: {payableItems.length}</Badge>
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

        <TabsContent value="packs" className="grid gap-4 pt-4">
          <PackQueue groups={packGroups} />
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
