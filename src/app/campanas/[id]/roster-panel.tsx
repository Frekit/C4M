"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  addTalentToCampaign,
  saveCampaignTalentPrices,
  setCampaignTalentStatus,
  activateCampaignTalent,
  type CampaignRosterResult,
} from "@/app/campanas/roster-actions";
import { CatalogSelect } from "@/components/catalog-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  CampaignProposalRow,
  CampaignRosterRow,
} from "@/lib/domain/campaign-roster";
import {
  canActivateLine,
  canMarkClientDecision,
  policyFromCampaign,
  quoteIsFrozen,
} from "@/lib/domain/campaign-desk";
import {
  CAMPAIGN_APPROVAL,
  CAMPAIGN_TALENT_STATUS,
  CAMPAIGN_TALENT_STATUS_LABELS,
  type CampaignApproval,
  type CampaignEngagement,
  type CampaignTalentStatus,
} from "@/lib/domain/enums";
import type { RosterCatalog } from "@/lib/domain/roster-catalog";
import { labelForSlug } from "@/lib/domain/roster-labels";
import { CURRENCIES } from "@/lib/currencies";
import {
  IG_COST_FORMAT,
  IG_COST_FORMAT_LABELS,
  costPackageLabel,
  isIgCostFormat,
} from "@/lib/domain/creator-cost-quote";
import { formatMoney, fromMinorUnits } from "@/lib/money";

import { AddToProposalForm } from "./proposal-panel";

function draftTitleFor(
  proposalId: string | null,
  drafts: CampaignProposalRow[]
) {
  if (!proposalId) return null;
  return drafts.find((proposal) => proposal.id === proposalId)?.title ?? null;
}

function waitingCopy(
  status: string,
  inDraft: string | null,
  clientApproves: boolean
) {
  if (status === CAMPAIGN_TALENT_STATUS.REJECTED) {
    return "Descartado. Corrige la línea y mételo en otra oleada si vuelve a entrar.";
  }
  if (inDraft) {
    return `Ya está en «${inDraft}», sin enviar. Márcala enviada cuando el lote esté cerrado.`;
  }
  if (clientApproves && status === CAMPAIGN_TALENT_STATUS.READY) {
    return "Lista para una oleada. El cliente la ve cuando la marques enviada.";
  }
  return null;
}

function toastResult(state: CampaignRosterResult | null) {
  if (!state) return;
  if (state.ok) toast.success("Mesa actualizada.");
  else if (state.error) toast.error(state.error);
}

function AddTalentForm({
  campaignId,
  catalog,
}: {
  campaignId: string;
  catalog: RosterCatalog;
}) {
  const [state, formAction, pending] = useActionState<
    CampaignRosterResult | null,
    FormData
  >(addTalentToCampaign, null);
  const [formEpoch, setFormEpoch] = useState(0);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Mesa actualizada.");
      setFormEpoch((epoch) => epoch + 1);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form
      key={formEpoch}
      action={formAction}
      className="grid gap-3 sm:grid-cols-4 sm:items-end"
    >
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="instagram">Instagram</Label>
        <Input id="instagram" name="instagram" required placeholder="@handle" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="country">País</Label>
        <CatalogSelect id="country" name="country" options={catalog.countries} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="profileType">Tipo</Label>
        <CatalogSelect
          id="profileType"
          name="profileType"
          options={catalog.profileTypes}
        />
      </div>
      <div className="sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Añadiendo…" : "Meter en esta campaña"}
        </Button>
      </div>
    </form>
  );
}

function QuoteForm({ row }: { row: CampaignRosterRow }) {
  const [state, formAction, pending] = useActionState<
    CampaignRosterResult | null,
    FormData
  >(saveCampaignTalentPrices, null);

  useEffect(() => toastResult(state), [state]);
  const [format, setFormat] = useState(row.contentFormat ?? "");

  const packaged = Boolean(format);
  const defaultCost = packaged
    ? row.packageCostMinor
    : (row.costMinorPerContent ?? row.creator.defaultCostMinor);
  const defaultCurrency =
    row.costCurrency ?? row.creator.defaultCostCurrency ?? "EUR";

  return (
    <form
      key={`${row.deliverableCount ?? ""}-${row.salePriceCentsPerContent ?? ""}-${row.packageCostMinor ?? ""}-${row.costMinorPerContent ?? ""}-${row.contentFormat ?? ""}-${row.costCurrency ?? ""}`}
      action={formAction}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="talentId" value={row.id} />
      <div className="grid gap-1">
        <Label className="text-xs">Formato</Label>
        <select
          name="contentFormat"
          value={format}
          onChange={(event) => setFormat(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        >
          <option value="">Sin formato</option>
          {Object.values(IG_COST_FORMAT).map((value) => (
            <option key={value} value={value}>
              {IG_COST_FORMAT_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Piezas</Label>
        <Input
          name="deliverableCount"
          defaultValue={row.deliverableCount ?? ""}
          placeholder="3"
          className="w-16"
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Venta USD / pieza</Label>
        <Input
          name="saleUsd"
          defaultValue={
            row.salePriceCentsPerContent != null
              ? String(row.salePriceCentsPerContent / 100)
              : ""
          }
          placeholder="250"
          className="w-24"
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">
          {packaged || row.contentFormat ? "Coste del paquete" : "Coste / pieza"}
        </Label>
        <Input
          name="cost"
          defaultValue={
            defaultCost != null
              ? String(fromMinorUnits(defaultCost, defaultCurrency))
              : ""
          }
          placeholder="80"
          className="w-20"
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Moneda</Label>
        <select
          name="currency"
          defaultValue={defaultCurrency}
          className="h-8 w-24 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        >
          {CURRENCIES.some((item) => item.code === defaultCurrency) ? null : (
            <option value={defaultCurrency}>{defaultCurrency}</option>
          )}
          {CURRENCIES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : "Guardar línea"}
      </Button>
      {format ? (
        <p className="w-full text-xs text-muted-foreground">
          Paquete a medida: el coste es el total cerrado, no la tarifa básica
          multiplicada por las piezas.
        </p>
      ) : null}
    </form>
  );
}

export function CampaignRosterPanel({
  campaignId,
  canWrite,
  rows,
  catalog,
  approvalMode,
  engagementKind,
  budgetSaleCents,
  drafts,
  hasClient,
}: {
  campaignId: string;
  canWrite: boolean;
  rows: CampaignRosterRow[];
  catalog: RosterCatalog;
  approvalMode: CampaignApproval;
  engagementKind: CampaignEngagement;
  budgetSaleCents: number | null;
  drafts: CampaignProposalRow[];
  hasClient: boolean;
}) {
  const policy = policyFromCampaign({
    engagementKind,
    approvalMode,
    budgetSaleCents,
  });
  const clientApproves = approvalMode === CAMPAIGN_APPROVAL.CLIENT_APPROVES;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mesa de la campaña</CardTitle>
        <CardDescription>
          Pueden entrar sin precio. Para activar (o mandar al cliente) hacen
          falta piezas + venta + coste. El mismo Instagram puede tener otra
          pasada más adelante.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {canWrite ? (
          <AddTalentForm campaignId={campaignId} catalog={catalog} />
        ) : null}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay perfiles en esta campaña.
          </p>
        ) : (
          <ul className="grid gap-4">
            {rows.map((row) => {
              const activate = canActivateLine(row, policy, rows);
              const inDraft = draftTitleFor(row.proposalId, drafts);
              const saleText =
                row.saleLabel && row.salePriceCentsPerContent != null
                  ? row.deliverableCount && row.deliverableCount > 1
                    ? `venta ${row.saleLabel}/pieza · ${formatMoney(
                        row.salePriceCentsPerContent * row.deliverableCount,
                        "USD"
                      )} la línea`
                    : `venta ${row.saleLabel}/pieza`
                  : null;
              return (
                <li key={row.id} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <Link
                        href={`/creators/${row.creator.id}`}
                        className="font-medium underline underline-offset-4"
                      >
                        @{row.creator.handle}
                      </Link>
                      {row.contract ? (
                        <p className="text-xs">
                          <Link
                            href={`/contratos/${row.contract.id}`}
                            className="underline underline-offset-4"
                          >
                            Contrato {row.contract.code}
                          </Link>
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {[
                          labelForSlug(catalog.countries, row.creator.country),
                          labelForSlug(
                            catalog.profileTypes,
                            row.creator.profileType
                          ),
                          row.contentFormat &&
                          isIgCostFormat(row.contentFormat) &&
                          row.deliverableCount
                            ? costPackageLabel(row.contentFormat, row.deliverableCount)
                            : row.deliverableCount
                              ? `${row.deliverableCount} piezas`
                              : null,
                          saleText,
                          row.packageCostMinor != null && row.costLabel
                            ? `paquete ${row.costLabel}`
                            : row.costLabel
                            ? `coste ${row.costLabel}`
                            : row.creator.defaultCostMinor != null
                              ? `tarifa ${formatMoney(
                                  row.creator.defaultCostMinor,
                                  row.creator.defaultCostCurrency ?? "EUR"
                                )}`
                              : "sin tarifa",
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sin país, tipo ni precios"}
                      </p>
                      {row.creator.costQuotes.length > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Tarifas básicas:{" "}
                          {row.creator.costQuotes
                            .map((quote) => `${quote.label} ${quote.amountLabel}`)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="outline">
                      {
                        CAMPAIGN_TALENT_STATUS_LABELS[
                          row.status as CampaignTalentStatus
                        ]
                      }
                    </Badge>
                  </div>

                  {row.others.length > 0 ? (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      También está en{" "}
                      {row.others
                        .map(
                          (item) =>
                            `${item.clientName ? `${item.clientName} · ` : ""}${item.campaignName} (${CAMPAIGN_TALENT_STATUS_LABELS[item.talentStatus]})`
                        )
                        .join(", ")}
                      .
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No aparece en otra campaña.
                    </p>
                  )}

                  {canWrite && !quoteIsFrozen(row.status) ? (
                    <div className="grid gap-3">
                      <QuoteForm row={row} />
                      {row.status === CAMPAIGN_TALENT_STATUS.READY ||
                      row.status === CAMPAIGN_TALENT_STATUS.ROSTER ? (
                        inDraft ? null : (
                          <AddToProposalForm
                            talentId={row.id}
                            drafts={drafts}
                          />
                        )
                      ) : null}
                      {activate.ok && hasClient ? (
                        <form action={activateCampaignTalent}>
                          <input type="hidden" name="talentId" value={row.id} />
                          <Button type="submit" size="sm">
                            Activar contrato
                          </Button>
                        </form>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {waitingCopy(row.status, inDraft, clientApproves) ??
                            (activate.ok
                              ? "Esta campaña no tiene cliente. Elígilo arriba antes de activar."
                              : activate.error)}
                        </p>
                      )}
                    </div>
                  ) : null}

                  {canWrite &&
                  clientApproves &&
                  canMarkClientDecision(approvalMode, row.status) ? (
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          CAMPAIGN_TALENT_STATUS.APPROVED,
                          CAMPAIGN_TALENT_STATUS.REJECTED,
                        ] as const
                      ).map((status) => (
                        <form key={status} action={setCampaignTalentStatus}>
                          <input
                            type="hidden"
                            name="talentId"
                            value={row.id}
                          />
                          <input type="hidden" name="status" value={status} />
                          <Button
                            type="submit"
                            size="sm"
                            variant={
                              row.status === status ? "default" : "ghost"
                            }
                          >
                            {CAMPAIGN_TALENT_STATUS_LABELS[status]}
                          </Button>
                        </form>
                      ))}
                    </div>
                  ) : null}

                  {canWrite &&
                  quoteIsFrozen(row.status) &&
                  row.status !== CAMPAIGN_TALENT_STATUS.REJECTED ? (
                    <div className="grid gap-3">
                      {row.status === CAMPAIGN_TALENT_STATUS.APPROVED &&
                      activate.ok &&
                      hasClient ? (
                        <form action={activateCampaignTalent}>
                          <input type="hidden" name="talentId" value={row.id} />
                          <Button type="submit" size="sm">
                            Activar contrato
                          </Button>
                        </form>
                      ) : row.status !== CAMPAIGN_TALENT_STATUS.ACTIVE &&
                        (activate.ok ? !hasClient : true) ? (
                        <p className="text-xs text-muted-foreground">
                          {activate.ok
                            ? "Esta campaña no tiene cliente. Elígilo arriba antes de activar."
                            : activate.error}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Cotización fijada. Para cambiarla, abre otra línea.
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
