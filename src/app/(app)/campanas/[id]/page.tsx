import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SetCrumbs } from "@/components/shell-context";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

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
import { committedSaleCents } from "@/lib/domain/campaign-desk";
import {
  loadCampaignProposals,
  loadCampaignRoster,
  loadRosterPicks,
} from "@/lib/domain/campaign-roster";
import { loadCampaignWorkbench } from "@/lib/domain/campaign-stats";
import { loadRosterCatalog } from "@/lib/domain/roster-catalog";
import {
  CAMPAIGN_APPROVAL_LABELS,
  CAMPAIGN_ENGAGEMENT_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  DELIVERABLE_STATUS_LABELS,
  type CampaignApproval,
  type CampaignEngagement,
  type CampaignStatus,
  type ContractStatus,
  type DeliverableStatus,
} from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";

import { getBaseUrl } from "@/lib/base-url";
import { assembleBriefing, renderClientStatus } from "@/lib/domain/campaign-briefing";
import { loadCampaignResults } from "@/lib/domain/campaign-results";
import { loadCampaignSheet } from "@/lib/domain/campaign-sheet";
import { loadTalentPlanilla } from "@/lib/domain/campaign-planilla";

import { CampaignBriefForm } from "./brief-form";
import { CampaignBulkSignature } from "./bulk-signature";
import { CampaignClientForm } from "./client-form";
import { CampaignPolicyCard } from "./policy-form";
import { CampaignProposalPanel } from "./proposal-panel";
import { CampaignResultsTable } from "./results-table";
import { CampaignRosterPanel } from "./roster-panel";
import { CampaignThread } from "./thread-panel";
import { TalentSheet } from "./talent-sheet";

export const metadata: Metadata = {
  title: "Campaña",
};

export default async function CampaignWorkbenchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const { id } = await params;
  const { vista } = await searchParams;
  const user = await requireUser(`/campanas/${id}`);
  const canSign = can(user.role, "signature:send");
  const canWrite = can(user.role, "campaigns:manage");

  if (!vista || vista === "planilla") {
    const planilla = await loadTalentPlanilla(id);
    if (!planilla) notFound();
    return (
      <PageShell width="wide">
        <SetCrumbs
          crumbs={[
            { label: "Campañas", href: "/campanas" },
            { label: planilla.campaign.name },
          ]}
        />
        <TalentSheet
          campaignId={planilla.campaign.id}
          campaignName={planilla.campaign.name}
          status={planilla.campaign.status}
          clientName={planilla.campaign.client?.name ?? null}
          starts={
            planilla.campaign.startsAt
              ? formatDate(planilla.campaign.startsAt)
              : null
          }
          ends={
            planilla.campaign.endsAt ? formatDate(planilla.campaign.endsAt) : null
          }
          rows={planilla.rows}
          canWrite={canWrite}
        />
      </PageShell>
    );
  }
  const [data, roster, picks, catalog, proposals, clients, sheet, results, messages, baseUrl] =
    await Promise.all([
    loadCampaignWorkbench(id),
    loadCampaignRoster(id),
    loadRosterPicks(id),
    loadRosterCatalog(),
    loadCampaignProposals(id),
    prisma.client.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    loadCampaignSheet(id),
    loadCampaignResults(id),
    prisma.campaignMessage.findMany({
      where: { campaignId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        authorKind: true,
        authorLabel: true,
        body: true,
        visibility: true,
        createdAt: true,
      },
    }),
    getBaseUrl(),
  ]);

  if (!data || !sheet) notFound();
  const packet = assembleBriefing({
    campaignName: sheet.campaign.name,
    clientName: sheet.campaign.client?.name ?? null,
    objective: sheet.campaign.briefObjective,
    audience: sheet.campaign.briefAudience,
    networks: sheet.campaign.briefNetworks,
    formats: sheet.campaign.briefFormats,
    notes: sheet.campaign.briefNotes,
    rows: sheet.rows,
    pulse: sheet.pulse,
    results,
  });
  const talkUrl = sheet.campaign.clientAccessToken
    ? `${baseUrl}/hablar/${sheet.campaign.clientAccessToken}`
    : null;

  return (
    <PageShell width="wide">
      <SetCrumbs
        crumbs={[
          { label: "Campañas", href: "/campanas" },
          { label: data.name, href: `/campanas/${id}` },
          { label: "Mesa" },
        ]}
      />
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link href="/campanas" className="hover:underline">
            Campañas
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-heading-24">
            {data.name}
          </h1>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/campanas/${id}/planilla`} />}
          >
            Catálogo
          </Button>
          <Badge variant="outline">
            {CAMPAIGN_STATUS_LABELS[data.status as CampaignStatus]}
          </Badge>
          <Badge variant="secondary">
            {
              CAMPAIGN_ENGAGEMENT_LABELS[
                data.engagementKind as CampaignEngagement
              ]
            }
          </Badge>
          <Badge variant="secondary">
            {CAMPAIGN_APPROVAL_LABELS[data.approvalMode as CampaignApproval]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {data.client ? (
            <>
              <Link
                href={`/clientes/${data.client.id}`}
                className="underline underline-offset-4"
              >
                {data.client.name}
              </Link>
              {" · "}
            </>
          ) : (
            <span className="text-amber-700 dark:text-amber-400">
              Sin cliente ·{" "}
            </span>
          )}
          {data.creatorCount}{" "}
          {data.creatorCount === 1 ? "perfil activo" : "perfiles activos"}
          {roster.length > 0
            ? ` · ${roster.length} en roster`
            : ""}
          {data.startsAt || data.endsAt
            ? ` · ${formatDate(data.startsAt)} → ${formatDate(data.endsAt)}`
            : ""}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-6">
      {canWrite ? (
        <CampaignClientForm
          campaignId={data.id}
          clientId={data.client?.id ?? ""}
          clients={clients}
        />
      ) : null}

      <CampaignBriefForm
        campaignId={data.id}
        canWrite={canWrite}
        objective={sheet.campaign.briefObjective}
        audience={sheet.campaign.briefAudience}
        networks={sheet.campaign.briefNetworks}
        formats={sheet.campaign.briefFormats}
        notes={sheet.campaign.briefNotes}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Contenidos"
          value={`${data.publishedCount}/${data.deliverableTotal}`}
          hint="Publicados en redes"
        />
        <StatCard
          label="Sin firmar"
          value={String(data.unsignedCount)}
          hint="Borrador o enviado"
        />
        <StatCard
          label="Firma caducada"
          value={String(data.expiredSignatureCount)}
        />
        <StatCard
          label="Sin enlace"
          value={String(data.missingLinkCount)}
          hint="Publicados sin URL"
        />
        <StatCard
          label="Pagados"
          value={String(data.paidCount)}
          hint="Con fecha de pago"
        />
      </div>

      {data.lateCount > 0 || data.platformErrorCount > 0 ? (
        <div className="flex flex-wrap gap-2">
          {data.lateCount > 0 ? (
            <Badge variant="destructive">Retrasados: {data.lateCount}</Badge>
          ) : null}
          {data.platformErrorCount > 0 ? (
            <Badge variant="destructive">
              Error plataforma: {data.platformErrorCount}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Estados</CardTitle>
          <CardDescription>
            Conteos SQL, sin cargar las filas. Entra a la cola filtrada.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.deliverableByStatus).map(([status, count]) => (
              <Badge key={status} variant="outline">
                {DELIVERABLE_STATUS_LABELS[status as DeliverableStatus] ?? status}
                : {count}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.contractsByStatus).map(([status, count]) => (
              <Badge key={status} variant="secondary">
                {CONTRACT_STATUS_LABELS[status as ContractStatus] ?? status}: {count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colas de esta campaña</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href={`/contenidos?campana=${data.id}`} />}
          >
            Contenidos
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/contratos?campana=${data.id}`} />}
          >
            Contratos
          </Button>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/finanzas?campana=${data.id}`} />}
          >
            Finanzas
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={
              <Link href={`/contenidos?campana=${data.id}&sinEnlace=1`} />
            }
          >
            Sin enlace ({data.missingLinkCount})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={
              <Link href={`/contenidos?campana=${data.id}&errorPlataforma=1`} />
            }
          >
            Error plataforma ({data.platformErrorCount})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={
              <Link href={`/contenidos?campana=${data.id}&retrasados=1`} />
            }
          >
            Retrasados ({data.lateCount})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={
              <Link href={`/contratos?campana=${data.id}&estado=SENT`} />
            }
          >
            Pendiente de firma ({data.unsignedCount})
          </Button>
        </CardContent>
      </Card>

      <CampaignPolicyCard
        campaignId={data.id}
        canWrite={canWrite}
        engagementKind={data.engagementKind as CampaignEngagement}
        approvalMode={data.approvalMode as CampaignApproval}
        budgetSaleCents={data.budgetSaleCents}
        defaultPaymentTermDays={data.defaultPaymentTermDays}
        committedCents={committedSaleCents(roster)}
      />

      <CampaignProposalPanel
        campaignId={data.id}
        canWrite={canWrite}
        approvalMode={data.approvalMode as CampaignApproval}
        proposals={proposals}
      />

      <CampaignResultsTable results={results} />

      <CampaignRosterPanel
        campaignId={data.id}
        canWrite={canWrite}
        rows={roster}
        picks={picks}
        catalog={catalog}
        approvalMode={data.approvalMode as CampaignApproval}
        engagementKind={data.engagementKind as CampaignEngagement}
        budgetSaleCents={data.budgetSaleCents}
        drafts={proposals.filter((item) => item.status === "DRAFT")}
        hasClient={Boolean(data.client)}
      />

      {canSign ? (
        <CampaignBulkSignature
          campaignId={data.id}
          unsignedCount={data.unsignedCount}
        />
      ) : null}

      {data.description ? (
        <p className="text-sm text-muted-foreground">{data.description}</p>
      ) : null}
      </div>
      <CampaignThread
        campaignId={data.id}
        canWrite={canWrite}
        messages={messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        }))}
        statusLine={renderClientStatus(packet)}
        onDesk={packet.onDesk.length}
        priced={packet.priced}
        active={packet.active}
        published={packet.published}
        total={packet.total}
        remainingLabel={packet.remainingLabel}
        budgetLabel={packet.budgetLabel}
        talkUrl={talkUrl}
      />
      </div>
    </PageShell>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
        {hint ? (
          <CardDescription>{hint}</CardDescription>
        ) : null}
      </CardHeader>
    </Card>
  );
}
