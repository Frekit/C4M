import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { SetCrumbs } from "@/components/shell-context";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FileTextIcon } from "lucide-react";

import { ContractChain } from "@/components/contract-chain";
import { CopyButton } from "@/components/copy-button";
import { PayeeCard } from "@/components/payee-card";
import { SignatureStatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { getBaseUrl } from "@/lib/base-url";
import { prisma } from "@/lib/db";
import { isDeliverableLate } from "@/lib/domain/rules";
import {
  buildContractView,
  getContractChain,
  getContractDetail,
} from "@/lib/domain/contracts";
import {
  CAMPAIGN_STATUS,
  CONTRACT_KIND,
  CONTRACT_KIND_LABELS,
  CONTRACT_STATUS,
  CONTRACT_STATUS_LABELS,
  SETTLEMENT_MODE,
  type ContractKind,
  type ContractStatus,
} from "@/lib/domain/enums";
import { contractPaymentCopy } from "@/lib/domain/payment-copy";
import { loadPackSummaries } from "@/lib/domain/pack-sync";
import { isAccruedDeliverable, packKey, settlementPolicyOf } from "@/lib/domain/settlement";
import { formatDate, formatDateTime, formatDateTimeUtc, toInputDate } from "@/lib/format";
import { formatMoney, formatPercent } from "@/lib/money";

import { revokeSignature } from "../actions";
import { ConditionsAnnexForm } from "./conditions-annex-form";
import { ContractCta } from "./contract-cta";
import { ContractFrame } from "./contract-frame";
import { DangerZone } from "./danger-zone";
import { DeliverableList } from "./deliverable-list";
import { ParticularsForm } from "./particulars-form";
import { SendSignatureCard } from "./send-signature-card";
import type { StatusTone } from "@/components/status-pill";

export const metadata: Metadata = {
  title: "Contrato",
};

const TABS = ["resumen", "contenidos", "firma", "historial"] as const;
type ContractTab = (typeof TABS)[number];

function contractTone(status: string): StatusTone {
  if (status === CONTRACT_STATUS.SIGNED) return "success";
  if (status === CONTRACT_STATUS.SENT) return "info";
  if (status === CONTRACT_STATUS.CANCELLED) return "destructive";
  return "neutral";
}

function contractStep(status: string) {
  if (status === CONTRACT_STATUS.DRAFT) return 0;
  if (status === CONTRACT_STATUS.SENT) return 1;
  if (status === CONTRACT_STATUS.SIGNED) return 2;
  if (status === CONTRACT_STATUS.COMPLETED || status === CONTRACT_STATUS.RENEWED) return 3;
  return -1;
}

export default async function ContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pestana?: string; pagina?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/contratos/${id}`);

  const contract = await getContractDetail(id);

  if (!contract) {
    notFound();
  }

  const view = buildContractView(contract);
  const [chain, packs] = await Promise.all([
    getContractChain(contract),
    loadPackSummaries(),
  ]);
  const baseUrl = await getBaseUrl();

  const accruedCostMinor = contract.deliverables.reduce((total, item) => {
    const policy = settlementPolicyOf({
      client: contract.client,
      campaign: item.campaign,
    });
    const pack =
      item.campaignId && policy?.settlementMode === SETTLEMENT_MODE.PACK
        ? packs.get(packKey(item.campaignId, contract.creatorId))
        : null;
    if (isAccruedDeliverable(item.status, policy, pack?.isComplete ?? false)) {
      return total + contract.costMinorPerContent;
    }
    return total;
  }, 0);
  const isAnnex = contract.kind === CONTRACT_KIND.ANNEX;
  const isConditionsAnnex = contract.kind === CONTRACT_KIND.CONDITIONS_ANNEX;
  const isCancelled = contract.status === CONTRACT_STATUS.CANCELLED;
  const isSigned = Boolean(view.signedSignature);
  const canWriteContracts = can(user.role, "contracts:write");

  // Planificar fechas y campañas se puede siempre. Publicado se puede forzar
  // con el contrato aún sin firmar; cancelado no se toca.
  const canEditDeliverables =
    can(user.role, "deliverables:publish") && !isCancelled;

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: CAMPAIGN_STATUS.ACTIVE,
      ...(contract.clientId ? { clientId: contract.clientId } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      client: { select: { name: true } },
    },
  });

  const tab: ContractTab = TABS.includes(query.pestana as ContractTab)
    ? (query.pestana as ContractTab)
    : "resumen";
  const page = Math.max(1, Number.parseInt(query.pagina ?? "1", 10) || 1);
  const pageSize = 20;
  const [siblings, history] = await Promise.all([
    prisma.contract.findMany({
      where: contract.clientId
        ? { clientId: contract.clientId, status: { not: CONTRACT_STATUS.CANCELLED } }
        : { id: contract.id },
      orderBy: { code: "asc" },
      select: { id: true, code: true },
      take: 80,
    }),
    prisma.auditEvent.findMany({
      where: {
        OR: [
          { entityType: "Contract", entityId: contract.id },
          {
            entityType: "Deliverable",
            entityId: { in: contract.deliverables.map((item) => item.id) },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);
  const siblingIndex = Math.max(
    0,
    siblings.findIndex((item) => item.id === contract.id)
  );
  const previous = siblingIndex > 0 ? siblings[siblingIndex - 1] : null;
  const following =
    siblingIndex < siblings.length - 1 ? siblings[siblingIndex + 1] : null;
  const dated = contract.deliverables.filter(
    (item) => item.scheduledFor || item.publishedAt
  ).length;
  const checklist = [
    {
      ok: contract.deliverables.length > 0 && dated === contract.deliverables.length,
      label:
        contract.deliverables.length > 0
          ? `${dated} de ${contract.deliverables.length} contenidos con fecha`
          : "Sin contenidos",
      href: `/contratos/${contract.id}?pestana=contenidos`,
    },
    {
      ok: contract.salePriceCentsPerContent > 0 && contract.costMinorPerContent > 0,
      label: "Venta y coste definidos",
      href: `/contratos/${contract.id}?pestana=resumen`,
    },
    {
      ok: (view.totals.marginRatio ?? 0) > 0,
      label: "Margen > 0",
      href: `/contratos/${contract.id}?pestana=resumen`,
    },
    {
      ok: Boolean(contract.startsAt && contract.endsAt),
      label: "Vigencia",
      href: `/contratos/${contract.id}?pestana=resumen`,
    },
    {
      ok: Boolean(contract.creator.contactEmail),
      label: "Email del creator",
      href: `/creators/${contract.creatorId}`,
    },
  ];
  const missing = checklist.find((item) => !item.ok);
  const blockReason =
    contract.status === CONTRACT_STATUS.DRAFT && missing
      ? `Antes de enviar falta: ${missing.label}`
      : null;
  const campaignName =
    contract.deliverables.find((item) => item.campaign)?.campaign?.name ?? null;
  const party = `${contract.creator.displayName || `@${contract.creator.handle}`} × ${contract.client?.name ?? "sin cliente"}`;
  const mapped = contract.deliverables.map((item) => ({
    id: item.id,
    position: item.position,
    status: item.status,
    campaignId: item.campaignId,
    contentDate: toInputDate(item.publishedAt ?? item.scheduledFor),
    paymentDueAt: item.paymentDueAt?.toISOString() ?? null,
    postUrl: item.postUrl,
    isLate: isDeliverableLate(item),
    costMinor: contract.costMinorPerContent,
    costCurrency: contract.costCurrency,
    contractSigned: isSigned,
    pack:
      item.campaignId &&
      settlementPolicyOf({
        client: contract.client,
        campaign: item.campaign,
      })?.settlementMode === SETTLEMENT_MODE.PACK
        ? (packs.get(packKey(item.campaignId, contract.creatorId)) ?? null)
        : null,
  }));
  const pageItems = mapped.slice((page - 1) * pageSize, page * pageSize);
  const pageCount = Math.max(1, Math.ceil(mapped.length / pageSize));
  const activeSignature = view.activeSignature;

  return (
    <PageShell width="default" className="pb-0">
      <SetCrumbs
        crumbs={[
          { label: "Contratos", href: "/contratos" },
          { label: contract.code },
        ]}
      />
      <ContractFrame
        code={contract.code}
        title={party}
        meta={[
          campaignName,
          `${contract.deliverableCount} contenidos`,
          `venta ${formatMoney(view.totals.saleTotalCents, "USD")}`,
          isAnnex && contract.parent
            ? `anexo de ${contract.parent.code}`
            : isConditionsAnnex && contract.parent
              ? `anexo de condiciones de ${contract.parent.code}`
              : null,
          `${CONTRACT_KIND_LABELS[contract.kind as ContractKind]} · creado el ${formatDate(contract.createdAt)}`,
        ]
          .filter(Boolean)
          .join(" · ")}
        statusLabel={CONTRACT_STATUS_LABELS[contract.status as ContractStatus]}
        tone={contractTone(contract.status)}
        step={contractStep(contract.status)}
        tab={tab}
        basePath={`/contratos/${contract.id}`}
        contentCount={contract.deliverables.length}
        prevHref={previous ? `/contratos/${previous.id}?pestana=${tab}` : null}
        nextHref={following ? `/contratos/${following.id}?pestana=${tab}` : null}
        positionLabel={
          siblings.length > 1 ? `${siblingIndex + 1}/${siblings.length}` : null
        }
        checklist={checklist}
        hint={
          blockReason ??
          (activeSignature
            ? `Enlace para ${activeSignature.recipientEmail}`
            : "Un solo paso principal, según el estado del contrato.")
        }
        secondary={
          <Button
            variant="outline"
            nativeButton={false}
            render={
              <a href={`/contratos/${contract.id}/documento`} target="_blank" rel="noreferrer" />
            }
          >
            <FileTextIcon />
            Ver PDF
          </Button>
        }
        primary={
          <ContractCta
            status={contract.status}
            contractId={contract.id}
            canSend={can(user.role, "signature:send") && !isCancelled}
            canRenew={can(user.role, "contracts:renew") && !isConditionsAnnex}
            blockReason={blockReason}
            defaultEmail={contract.creator.contactEmail}
            signatureUrl={
              activeSignature ? `${baseUrl}/firmar/${activeSignature.token}` : null
            }
            requestId={activeSignature?.id ?? null}
            renewHref={`/contratos/${contract.id}/renovar`}
            pdfHref={`/contratos/${contract.id}/documento`}
            contentsHref={`/contratos/${contract.id}?pestana=contenidos`}
          />
        }
      >
      {tab === "resumen" ? (
      <>
      {isCancelled ? (
        <Alert variant="destructive">
          <AlertTitle>Contrato cancelado</AlertTitle>
          <AlertDescription>
            {contract.cancelReason
              ? `Motivo: ${contract.cancelReason}. `
              : ""}
            Se conserva su historial y sus importes devengados.
          </AlertDescription>
        </Alert>
      ) : null}

      {view.totals.hasNegativeMargin ? (
        <Alert variant="destructive">
          <AlertTitle>Margen negativo</AlertTitle>
          <AlertDescription>
            El coste del creator supera el precio de venta al cliente.
          </AlertDescription>
        </Alert>
      ) : null}

      {isConditionsAnnex ? (
        <Alert>
          <AlertTitle>Sin cambio de contenidos ni importes</AlertTitle>
          <AlertDescription>
            Este anexo solo actualiza las condiciones particulares. El precio, el
            plazo y los contenidos de {contract.parent?.code ?? "origen"} siguen
            igual.
          </AlertDescription>
        </Alert>
      ) : (
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Entregados</CardDescription>
            <CardTitle className="text-2xl">
              {view.progress.published}
              <span className="text-base text-muted-foreground">
                /{view.progress.total}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress
              value={view.progress.ratio * 100}
              aria-label="Contenidos entregados"
              className="h-1.5"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Devengado al creator</CardDescription>
            <CardTitle className="text-2xl">
              {formatMoney(accruedCostMinor, contract.costCurrency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            de {formatMoney(view.totals.costTotalMinor, contract.costCurrency)}{" "}
            pactado
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Margen previsto</CardDescription>
            <CardTitle className="text-2xl">
              {formatMoney(view.totals.marginTotalUsdCents, "USD")}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {view.totals.marginRatio === null
              ? "—"
              : `${formatPercent(view.totals.marginRatio)} sobre venta`}
          </CardContent>
        </Card>
      </div>
      )}

      {isConditionsAnnex ? null : (
      <Card>
        <CardHeader>
          <CardTitle>Condiciones económicas</CardTitle>
          <CardDescription>
            El tipo de cambio queda congelado al crear el contrato, así el margen
            no se mueve después.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Contenidos</dt>
              <dd className="font-medium">{contract.deliverableCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Venta por contenido</dt>
              <dd className="font-medium">
                {formatMoney(contract.salePriceCentsPerContent, "USD")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Coste por contenido</dt>
              <dd className="font-medium">
                {formatMoney(
                  contract.costMinorPerContent,
                  contract.costCurrency
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Coste en USD</dt>
              <dd>{formatMoney(contract.costUsdCentsPerContent, "USD")}</dd>
            </div>
          </dl>

          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Venta total</dt>
              <dd className="font-medium">
                {formatMoney(view.totals.saleTotalCents, "USD")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Coste total</dt>
              <dd className="font-medium">
                {formatMoney(view.totals.costTotalMinor, contract.costCurrency)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Tipo de cambio</dt>
              <dd>
                {contract.costCurrency === "USD"
                  ? "—"
                  : `${contract.fxUnitsPerUsd} ${contract.costCurrency}/USD`}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Plazo de pago</dt>
              <dd>
                {
                  contractPaymentCopy({
                    settlementMode: contract.client?.settlementMode,
                    paymentTermDays: contract.paymentTermDays,
                  }).term
                }
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Condiciones particulares</CardTitle>
          <CardDescription>
            {view.canEditParticulars
              ? "Pactadas con este talento. El PDF se regenera al guardar."
              : "Pactadas con este talento. Si el contrato ya está firmado, cualquier cambio va en un anexo."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canWriteContracts && view.canEditParticulars ? (
            <ParticularsForm
              contractId={contract.id}
              notes={contract.notes}
              hasLiveSignature={Boolean(view.activeSignature)}
            />
          ) : contract.notes ? (
            <p className="text-sm whitespace-pre-line text-muted-foreground">
              {contract.notes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No hay condiciones particulares además de las cláusulas generales
              del contrato.
            </p>
          )}
        </CardContent>
      </Card>
      </>
      ) : null}

      {tab === "contenidos" && !isConditionsAnnex ? (
      <Card>
        <CardHeader>
          <CardTitle>Contenidos</CardTitle>
          <CardDescription>
            {canEditDeliverables
              ? isSigned
                ? "Cambia fecha, enlace, campaña o estado y se guarda solo. Para publicar hacen falta enlace y fecha. En plataforma es solo para clientes con plataforma."
                : "Puedes poner fecha, enlace y campaña desde ya. Publicado se puede forzar aunque el contrato siga sin firmar: te lo pedirá confirmar y el acuerdo permanece pendiente."
              : "Tu rol no permite editar contenidos."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeliverableList
            canEdit={canEditDeliverables}
            campaigns={campaigns.map((campaign) => ({
              id: campaign.id,
              name: campaign.name,
              clientName: campaign.client?.name ?? null,
            }))}
            deliverables={pageItems}
          />
          {pageCount > 1 ? (
            <div className="mt-3 flex items-center justify-between text-copy-13">
              <span>
                {page} de {pageCount}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/contratos/${contract.id}?pestana=contenidos&pagina=${page - 1}`}
                      />
                    }
                  >
                    Anterior
                  </Button>
                ) : null}
                {page < pageCount ? (
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={`/contratos/${contract.id}?pestana=contenidos&pagina=${page + 1}`}
                      />
                    }
                  >
                    Siguiente
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
      ) : null}

      {tab === "firma" ? (
      <>
      {view.signedSignature ? (
        <Card>
          <CardHeader>
            <CardTitle>Firma</CardTitle>
            <CardDescription>
              Rastro de auditoría de la aceptación.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-muted-foreground">Firmante</span>
              <span className="font-medium">
                {view.signedSignature.signerFullName} (
                {view.signedSignature.recipientEmail})
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Fecha</span>
              <span>{formatDateTimeUtc(view.signedSignature.signedAt)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">IP</span>
              <span>{view.signedSignature.signerIp ?? "no registrada"}</span>
            </div>
            {view.signedSignature.documentSha256 ? (
              <div className="grid gap-1">
                <span className="text-muted-foreground">
                  Huella SHA-256 del documento
                </span>
                <span className="font-mono text-xs break-all">
                  {view.signedSignature.documentSha256}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : view.activeSignature ? (
        <Card>
          <CardHeader>
            <CardTitle>Firma pendiente</CardTitle>
            <CardDescription>
              Enviado a {view.activeSignature.recipientEmail}. Caduca el{" "}
              {formatDateTime(view.activeSignature.expiresAt)}.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SignatureStatusBadge status={view.activeSignature.status} />
              {view.activeSignature.viewedAt ? (
                <span className="text-xs text-muted-foreground">
                  Abierto el {formatDateTime(view.activeSignature.viewedAt)}
                </span>
              ) : null}
            </div>
            <code className="rounded bg-muted px-2 py-1 text-xs break-all">
              {baseUrl}/firmar/{view.activeSignature.token}
            </code>
            <div className="flex flex-wrap gap-2">
              <CopyButton
                value={`${baseUrl}/firmar/${view.activeSignature.token}`}
              />
              {can(user.role, "signature:send") ? (
                <form action={revokeSignature}>
                  <input
                    type="hidden"
                    name="requestId"
                    value={view.activeSignature.id}
                  />
                  <Button type="submit" variant="ghost" size="sm">
                    Revocar enlace
                  </Button>
                </form>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : can(user.role, "signature:send") && !isCancelled ? (
        <SendSignatureCard
          contractId={contract.id}
          baseUrl={baseUrl}
          defaultEmail={contract.creator.contactEmail}
        />
      ) : null}

      <PayeeCard
        payee={view.signedSignature?.payee ?? null}
        canSeeFullAccount={can(user.role, "payees:read_full")}
      />

      {canWriteContracts && view.canCreateConditionsAnnex && !isCancelled ? (
        <ConditionsAnnexForm
          parentId={contract.id}
          parentCode={contract.code}
        />
      ) : null}
      </>
      ) : null}

      {tab === "resumen" && chain.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Cadena de contratos</CardTitle>
            <CardDescription>
              Todo lo firmado con @{contract.creator.handle} en este hilo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContractChain chain={chain} currentId={contract.id} />
          </CardContent>
        </Card>
      ) : null}

      {tab === "resumen" && can(user.role, "contracts:cancel") && !isCancelled ? (
        <DangerZone
          contractId={contract.id}
          canDelete={view.canDelete}
          blockReason={
            view.hasCommitment
              ? "Tiene firma enviada o contenidos publicados, así que ya no se puede borrar: solo cancelar."
              : "Solo los borradores sin firma ni publicaciones pueden borrarse."
          }
        />
      ) : null}

      {tab === "historial" ? (
        history.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-8 text-center">
            <h2 className="font-serif text-[22px] leading-7">Sin actividad</h2>
            <p className="mt-1 text-copy-13 text-muted-foreground">
              Aquí verás quién creó, envió y firmó este contrato.
            </p>
          </div>
        ) : (
          <ol className="grid gap-2">
            {history.map((event) => (
              <li key={event.id} className="rounded-lg border bg-card px-3 py-2">
                <p className="text-label-13">
                  {event.actorEmail ?? "Alguien"} · {event.action}
                </p>
                <p className="text-copy-12 text-fg-subtle">{formatDateTime(event.createdAt)}</p>
              </li>
            ))}
          </ol>
        )
      ) : null}
      </ContractFrame>
    </PageShell>
  );
}
