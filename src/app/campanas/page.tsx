import Link from "next/link";
import type { Metadata } from "next";
import { MegaphoneIcon } from "lucide-react";

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
import { prisma } from "@/lib/db";
import { loadCampaignSummaries } from "@/lib/domain/campaign-stats";
import {
  CAMPAIGN_APPROVAL_LABELS,
  CAMPAIGN_ENGAGEMENT_LABELS,
  CAMPAIGN_STATUS,
  CAMPAIGN_STATUS_LABELS,
  SETTLEMENT_MODE_LABELS,
  type CampaignApproval,
  type CampaignEngagement,
  type CampaignStatus,
  type SettlementMode,
} from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";

import { setCampaignStatus, deleteCampaign } from "./actions";
import { CampaignForm } from "./campaign-form";

export const metadata: Metadata = {
  title: "Campañas",
};

export default async function CampaignsPage() {
  const user = await requireUser("/campanas");
  const canManage = can(user.role, "campaigns:manage");

  const [summaries, clients] = await Promise.all([
    loadCampaignSummaries(),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Campañas
        </h1>
        <p className="text-sm text-muted-foreground">
          Agrupan contenidos de distintos creators bajo un cliente. Higgsfield
          se liquida pieza a pieza; Many Chat, cuando el perfil termina el pack.
          Pack vs plataforma se cambia en{" "}
          <Link href="/clientes" className="underline underline-offset-4">
            Clientes
          </Link>
          .
        </p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Nueva campaña</CardTitle>
            <CardDescription>
              El nombre es lo único obligatorio; las fechas ayudan a ordenar el
              calendario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CampaignForm clients={clients} />
          </CardContent>
        </Card>
      ) : null}

      {summaries.length === 0 ? (
        <Card>
          <CardHeader>
            <MegaphoneIcon className="size-5 text-muted-foreground" />
            <CardTitle>Todavía no hay campañas</CardTitle>
            <CardDescription>
              Crea la primera y luego asigna contenidos desde{" "}
              <Link href="/contenidos" className="underline underline-offset-4">
                Contenidos
              </Link>
              .
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {summaries.map(({ campaign, total, published }) => {
            return (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>
                      <Link
                        href={`/campanas/${campaign.id}`}
                        className="hover:underline"
                      >
                        {campaign.name}
                      </Link>
                    </CardTitle>
                    <Badge
                      variant={
                        campaign.status === CAMPAIGN_STATUS.ACTIVE
                          ? "default"
                          : "outline"
                      }
                    >
                      {CAMPAIGN_STATUS_LABELS[campaign.status as CampaignStatus]}
                    </Badge>
                    <Badge variant="outline">
                      {
                        CAMPAIGN_ENGAGEMENT_LABELS[
                          campaign.engagementKind as CampaignEngagement
                        ]
                      }
                    </Badge>
                    <Badge variant="outline">
                      {
                        CAMPAIGN_APPROVAL_LABELS[
                          campaign.approvalMode as CampaignApproval
                        ]
                      }
                    </Badge>
                  </div>
                  <CardDescription>
                    {campaign.client ? (
                      <>
                        <Link
                          href={`/clientes/${campaign.client.id}`}
                          className="underline underline-offset-4"
                        >
                          {campaign.client.name}
                        </Link>
                        {` · ${SETTLEMENT_MODE_LABELS[campaign.client.settlementMode as SettlementMode]}${campaign.client.requiresPlatformSubmit ? " · plataforma" : ""} · `}
                      </>
                    ) : null}
                    {campaign.startsAt || campaign.endsAt
                      ? `${formatDate(campaign.startsAt)} → ${formatDate(campaign.endsAt)}`
                      : "Sin fechas"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {campaign.description ? (
                    <p className="text-sm text-muted-foreground">
                      {campaign.description}
                    </p>
                  ) : null}

                  <div className="grid gap-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {published}/{total} publicados
                      </span>
                    </div>
                    <Progress
                      value={total > 0 ? (published / total) * 100 : 0}
                      className="h-1.5"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/campanas/${campaign.id}`} />}
                    >
                      Banco de trabajo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`/campanas/${campaign.id}/planilla`} />}
                    >
                      Elegir perfiles
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={
                        <Link href={`/contenidos?campana=${campaign.id}`} />
                      }
                    >
                      Ver contenidos
                    </Button>

                    {campaign.client ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        nativeButton={false}
                        render={
                          <Link href={`/clientes/${campaign.client.id}`} />
                        }
                      >
                        Cliente
                      </Button>
                    ) : null}

                    {canManage ? (
                      <>
                        <form action={setCampaignStatus}>
                          <input
                            type="hidden"
                            name="campaignId"
                            value={campaign.id}
                          />
                          <input
                            type="hidden"
                            name="status"
                            value={
                              campaign.status === CAMPAIGN_STATUS.ACTIVE
                                ? CAMPAIGN_STATUS.CLOSED
                                : CAMPAIGN_STATUS.ACTIVE
                            }
                          />
                          <Button type="submit" variant="ghost" size="sm">
                            {campaign.status === CAMPAIGN_STATUS.ACTIVE
                              ? "Cerrar"
                              : "Reabrir"}
                          </Button>
                        </form>

                        {total === 0 ? (
                          <form action={deleteCampaign}>
                            <input
                              type="hidden"
                              name="campaignId"
                              value={campaign.id}
                            />
                            <Button type="submit" variant="ghost" size="sm">
                              Borrar
                            </Button>
                          </form>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
