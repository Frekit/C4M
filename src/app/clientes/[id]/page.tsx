import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
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
import {
  CAMPAIGN_TALENT_STATUS_LABELS,
  type CampaignTalentStatus,
} from "@/lib/domain/enums";
import { isCampaignTalentStatus } from "@/lib/domain/campaign-talent";

import { ClientForm } from "./client-form";

export const metadata: Metadata = {
  title: "Cliente",
};

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/clientes/${id}`);
  const canManage = can(user.role, "campaigns:manage");

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      _count: { select: { campaigns: true, contracts: true } },
      campaigns: {
        orderBy: { createdAt: "desc" },
        include: {
          talents: {
            orderBy: { createdAt: "desc" },
            include: {
              creator: { select: { id: true, handle: true } },
            },
          },
        },
      },
    },
  });

  if (!client) {
    notFound();
  }

  const creatorIds = new Set(
    client.campaigns.flatMap((campaign) =>
      campaign.talents.map((talent) => talent.creatorId)
    )
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link href="/clientes" className="hover:underline">
            Clientes
          </Link>
        </p>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          {client.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {client._count.campaigns} campañas · {creatorIds.size}{" "}
          {creatorIds.size === 1 ? "perfil" : "perfiles"} ·{" "}
          {client._count.contracts} contratos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfiles en sus campañas</CardTitle>
          <CardDescription>
            Quién está con esta marca, en qué campaña y en qué punto. Entra
            en cuanto se mete en la mesa, antes del contrato.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {client.campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Esta marca todavía no tiene campañas.
            </p>
          ) : (
            <ul className="grid gap-4">
              {client.campaigns.map((campaign) => (
                <li key={campaign.id} className="grid gap-2">
                  <Link
                    href={`/campanas/${campaign.id}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {campaign.name}
                  </Link>
                  {campaign.talents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Sin perfiles en la mesa.
                    </p>
                  ) : (
                    <ul className="grid gap-1">
                      {campaign.talents.map((talent) => (
                        <li
                          key={talent.id}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <Link
                            href={`/creators/${talent.creator.id}`}
                            className="underline underline-offset-4"
                          >
                            @{talent.creator.handle}
                          </Link>
                          {isCampaignTalentStatus(talent.status) ? (
                            <Badge variant="outline">
                              {
                                CAMPAIGN_TALENT_STATUS_LABELS[
                                  talent.status as CampaignTalentStatus
                                ]
                              }
                            </Badge>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Liquidación</CardTitle>
          <CardDescription>
            Pack o pieza, y si Finanzas tiene que subir a una plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <ClientForm client={client} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu rol no permite editar clientes.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
