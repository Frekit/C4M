"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ASSIGN_FILTER_BATCH } from "@/lib/domain/enums";
import type { ContentFilters } from "@/lib/domain/contents-query";

import {
  assignCampaign,
  assignCampaignToFilter,
  type DeliverableActionResult,
} from "./actions";

export function BulkCampaignBar({
  campaigns,
  filters,
  matchingCount,
}: {
  campaigns: { id: string; name: string; clientName?: string | null }[];
  filters: ContentFilters;
  matchingCount: number;
}) {
  const [state, formAction, pending] = useActionState<
    DeliverableActionResult | null,
    FormData
  >(assignCampaign, null);
  const [filterState, filterAction, filterPending] = useActionState<
    DeliverableActionResult | null,
    FormData
  >(assignCampaignToFilter, null);

  useEffect(() => {
    if (state?.ok) toast.success("Contenidos agrupados en la campaña");
    if (state && !state.ok && state.error) toast.error(state.error);
  }, [state]);

  useEffect(() => {
    if (filterState?.ok) {
      toast.success(
        matchingCount > ASSIGN_FILTER_BATCH
          ? `Asignados ${ASSIGN_FILTER_BATCH} del filtro. Pulsa otra vez para el siguiente lote.`
          : "Filtro asignado a la campaña"
      );
    }
    if (filterState && !filterState.ok && filterState.error) {
      toast.error(filterState.error);
    }
  }, [filterState, matchingCount]);

  const busy = pending || filterPending;
  const filterCap = Math.min(ASSIGN_FILTER_BATCH, matchingCount);

  return (
    <form
      id="bulk-campaign"
      action={formAction}
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3"
    >
      <input type="hidden" name="filterCreador" value={filters.creador ?? ""} />
      <input type="hidden" name="filterCampana" value={filters.campana ?? ""} />
      <input type="hidden" name="filterEstado" value={filters.estado ?? ""} />
      <input type="hidden" name="filterDesde" value={filters.desde ?? ""} />
      <input type="hidden" name="filterHasta" value={filters.hasta ?? ""} />
      <input
        type="hidden"
        name="filterRetrasados"
        value={filters.retrasados === "1" ? "1" : ""}
      />
      <input
        type="hidden"
        name="filterSinEnlace"
        value={filters.sinEnlace === "1" ? "1" : ""}
      />
      <input
        type="hidden"
        name="filterErrorPlataforma"
        value={filters.errorPlataforma === "1" ? "1" : ""}
      />
      <input
        type="hidden"
        name="filterSinFirmar"
        value={filters.sinFirmar === "1" ? "1" : ""}
      />

      <span className="text-sm text-muted-foreground">
        Agrupa esta página o los {matchingCount} del filtro:
      </span>

      <select
        name="campaignId"
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        aria-label="Campaña a asignar"
      >
        <option value="">Quitar campaña</option>
        {campaigns.map((campaign) => (
          <option key={campaign.id} value={campaign.id}>
            {campaign.clientName
              ? `${campaign.name} · ${campaign.clientName}`
              : campaign.name}
          </option>
        ))}
      </select>

      <Button type="submit" size="sm" disabled={busy}>
        {pending ? "Asignando…" : "Asignar a los seleccionados"}
      </Button>
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        disabled={busy || matchingCount === 0}
        formAction={filterAction}
      >
        {filterPending ? "Asignando filtro…" : `Asignar a ${filterCap} del filtro`}
      </Button>
    </form>
  );
}
