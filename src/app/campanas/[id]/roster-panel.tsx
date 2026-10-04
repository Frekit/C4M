"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
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
import { canActivateLine, policyFromCampaign } from "@/lib/domain/campaign-desk";
import {
  CAMPAIGN_APPROVAL,
  CAMPAIGN_TALENT_STATUS,
  CAMPAIGN_TALENT_STATUS_LABELS,
  type CampaignApproval,
  type CampaignEngagement,
  type CampaignTalentStatus,
} from "@/lib/domain/enums";
import type { RosterCatalog } from "@/lib/domain/roster-catalog";
import { labelForSlug } from "@/lib/domain/roster-catalog";

import { AddToProposalForm } from "./proposal-panel";

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

  useEffect(() => toastResult(state), [state]);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-4 sm:items-end">
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

  const defaultCost =
    row.costMinorPerContent ?? row.creator.defaultCostMinor;
  const defaultCurrency =
    row.costCurrency ?? row.creator.defaultCostCurrency ?? "EUR";

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="talentId" value={row.id} />
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
        <Label className="text-xs">Venta USD</Label>
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
        <Label className="text-xs">Coste</Label>
        <Input
          name="cost"
          defaultValue={
            defaultCost != null ? String(defaultCost / 100) : ""
          }
          placeholder="80"
          className="w-20"
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Moneda</Label>
        <Input name="currency" defaultValue={defaultCurrency} className="w-20" />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : "Guardar línea"}
      </Button>
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
}: {
  campaignId: string;
  canWrite: boolean;
  rows: CampaignRosterRow[];
  catalog: RosterCatalog;
  approvalMode: CampaignApproval;
  engagementKind: CampaignEngagement;
  budgetSaleCents: number | null;
  drafts: CampaignProposalRow[];
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
                      <p className="text-xs text-muted-foreground">
                        {[
                          labelForSlug(catalog.countries, row.creator.country),
                          labelForSlug(
                            catalog.profileTypes,
                            row.creator.profileType
                          ),
                          row.deliverableCount
                            ? `${row.deliverableCount} piezas`
                            : null,
                          row.saleLabel ? `venta ${row.saleLabel}` : null,
                          row.costLabel ? `coste ${row.costLabel}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "Sin país, tipo ni precios"}
                      </p>
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
                            `${item.campaignName} (${CAMPAIGN_TALENT_STATUS_LABELS[item.talentStatus]})`
                        )
                        .join(", ")}
                      .
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No aparece en otra campaña.
                    </p>
                  )}

                  {canWrite && row.status !== CAMPAIGN_TALENT_STATUS.ACTIVE ? (
                    <div className="grid gap-3">
                      <QuoteForm row={row} />
                      {clientApproves ? (
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
                              <input
                                type="hidden"
                                name="status"
                                value={status}
                              />
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
                      {row.status === CAMPAIGN_TALENT_STATUS.READY ||
                      row.status === CAMPAIGN_TALENT_STATUS.ROSTER ? (
                        <AddToProposalForm talentId={row.id} drafts={drafts} />
                      ) : null}
                      {activate.ok ? (
                        <form action={activateCampaignTalent}>
                          <input type="hidden" name="talentId" value={row.id} />
                          <Button type="submit" size="sm">
                            Activar contrato
                          </Button>
                        </form>
                      ) : row.status !== CAMPAIGN_TALENT_STATUS.REJECTED ? (
                        <p className="text-xs text-muted-foreground">
                          {activate.error}
                        </p>
                      ) : null}
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
