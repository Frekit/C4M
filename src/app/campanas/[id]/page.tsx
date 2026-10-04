import Link from "next/link";
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
import { loadCampaignRoster } from "@/lib/domain/campaign-roster";
import { loadCampaignWorkbench } from "@/lib/domain/campaign-stats";
import { loadRosterCatalog } from "@/lib/domain/roster-catalog";
import {
  CAMPAIGN_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  DELIVERABLE_STATUS_LABELS,
  type CampaignStatus,
  type ContractStatus,
  type DeliverableStatus,
} from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";

import { CampaignBulkSignature } from "./bulk-signature";
import { CampaignRosterPanel } from "./roster-panel";

export const metadata: Metadata = {
  title: "Campaña",
};

export default async function CampaignWorkbenchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/campanas/${id}`);
  const canSign = can(user.role, "signature:send");
  const canWrite = can(user.role, "campaigns:manage");
  const [data, roster, catalog] = await Promise.all([
    loadCampaignWorkbench(id),
    loadCampaignRoster(id),
    loadRosterCatalog(),
  ]);

  if (!data) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link href="/campanas" className="hover:underline">
            Campañas
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-medium tracking-tight">
            {data.name}
          </h1>
          <Badge variant="outline">
            {CAMPAIGN_STATUS_LABELS[data.status as CampaignStatus]}
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
          ) : null}
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

      <CampaignRosterPanel
        campaignId={data.id}
        canWrite={canWrite}
        rows={roster}
        catalog={catalog}
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
    </main>
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
