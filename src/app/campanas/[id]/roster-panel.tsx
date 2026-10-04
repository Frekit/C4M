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
import type { CampaignRosterRow } from "@/lib/domain/campaign-roster";
import {
  CAMPAIGN_TALENT_STATUS,
  CAMPAIGN_TALENT_STATUS_LABELS,
  PROFILE_TYPE_SUGGESTIONS,
  type CampaignTalentStatus,
} from "@/lib/domain/enums";

function toastResult(state: CampaignRosterResult | null) {
  if (!state) return;
  if (state.ok) toast.success("Roster actualizado.");
  else if (state.error) toast.error(state.error);
}

function AddTalentForm({ campaignId }: { campaignId: string }) {
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
        <Input id="country" name="country" placeholder="Opcional" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="profileType">Tipo</Label>
        <Input
          id="profileType"
          name="profileType"
          list="campaign-profile-types"
          placeholder="Opcional"
        />
        <datalist id="campaign-profile-types">
          {PROFILE_TYPE_SUGGESTIONS.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
      </div>
      <div className="sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Añadiendo…" : "Meter en esta campaña"}
        </Button>
      </div>
    </form>
  );
}

function PricesForm({ talentId }: { talentId: string }) {
  const [state, formAction, pending] = useActionState<
    CampaignRosterResult | null,
    FormData
  >(saveCampaignTalentPrices, null);

  useEffect(() => toastResult(state), [state]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="talentId" value={talentId} />
      <div className="grid gap-1">
        <Label className="text-xs">Venta USD</Label>
        <Input name="saleUsd" placeholder="250" className="w-24" />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Coste</Label>
        <Input name="cost" placeholder="80" className="w-24" />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs">Moneda</Label>
        <Input name="currency" defaultValue="EUR" className="w-20" />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : "Guardar y proponer"}
      </Button>
    </form>
  );
}

export function CampaignRosterPanel({
  campaignId,
  canWrite,
  rows,
}: {
  campaignId: string;
  canWrite: boolean;
  rows: CampaignRosterRow[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roster de la campaña</CardTitle>
        <CardDescription>
          Primero el Instagram. Si hay precios, se lo pasáis al cliente. Si
          valida, se activa. Si el perfil está en otra campaña, sale aquí.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {canWrite ? <AddTalentForm campaignId={campaignId} /> : null}

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay perfiles en esta campaña.
          </p>
        ) : (
          <ul className="grid gap-4">
            {rows.map((row) => (
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
                      {[row.creator.country, row.creator.profileType]
                        .filter(Boolean)
                        .join(" · ") || "Sin país ni tipo"}
                      {row.saleLabel
                        ? ` · venta ${row.saleLabel}`
                        : " · sin precio"}
                      {row.costLabel ? ` · coste ${row.costLabel}` : ""}
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

                {canWrite ? (
                  <div className="grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          CAMPAIGN_TALENT_STATUS.ROSTER,
                          CAMPAIGN_TALENT_STATUS.PROPOSED,
                          CAMPAIGN_TALENT_STATUS.APPROVED,
                          CAMPAIGN_TALENT_STATUS.REJECTED,
                        ] as const
                      ).map((status) => (
                        <form key={status} action={setCampaignTalentStatus}>
                          <input type="hidden" name="talentId" value={row.id} />
                          <input type="hidden" name="status" value={status} />
                          <Button
                            type="submit"
                            size="sm"
                            variant={row.status === status ? "default" : "ghost"}
                          >
                            {CAMPAIGN_TALENT_STATUS_LABELS[status]}
                          </Button>
                        </form>
                      ))}
                    </div>
                    <PricesForm talentId={row.id} />
                    {row.status === CAMPAIGN_TALENT_STATUS.APPROVED ||
                    row.status === CAMPAIGN_TALENT_STATUS.PROPOSED ? (
                      <form
                        action={activateCampaignTalent}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="talentId" value={row.id} />
                        <div className="grid gap-1">
                          <Label className="text-xs">Piezas</Label>
                          <Input
                            name="deliverableCount"
                            defaultValue="1"
                            className="w-20"
                          />
                        </div>
                        <Button type="submit" size="sm">
                          Activar en campaña
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
