"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  addCreatorsToCampaign,
  pasteTalentToCampaign,
  type CampaignRosterResult,
} from "@/app/campanas/roster-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CampaignSheetRow } from "@/lib/domain/campaign-sheet";

function resultToast(state: CampaignRosterResult | null) {
  if (!state) return;
  if (state.ok) {
    const skipped = state.skipped ?? 0;
    toast.success(
      skipped > 0
        ? `Metí ${state.added ?? 0}. ${skipped} ya estaban o no valían.`
        : `Metí ${state.added ?? 0} ${state.added === 1 ? "perfil" : "perfiles"}.`
    );
  } else if (state.error) {
    toast.error(state.error);
  }
}

export function CampaignSheet({
  campaignId,
  rows,
  canWrite,
}: {
  campaignId: string;
  rows: CampaignSheetRow[];
  canWrite: boolean;
}) {
  const [pickState, pickAction, pickPending] = useActionState<
    CampaignRosterResult | null,
    FormData
  >(addCreatorsToCampaign, null);
  const [pasteState, pasteAction, pastePending] = useActionState<
    CampaignRosterResult | null,
    FormData
  >(pasteTalentToCampaign, null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pasteEpoch, setPasteEpoch] = useState(0);

  useEffect(() => {
    if (!pickState) return;
    resultToast(pickState);
    if (pickState.ok) setSelected(new Set());
  }, [pickState]);

  useEffect(() => {
    if (!pasteState) return;
    resultToast(pasteState);
    if (pasteState.ok) setPasteEpoch((epoch) => epoch + 1);
  }, [pasteState]);

  const selectableIds = rows.filter((row) => row.selectable).map((row) => row.id);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const id of selectableIds) next.delete(id);
      } else {
        for (const id of selectableIds) next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="grid gap-3">
      <form action={pickAction} className="grid gap-3">
        <input type="hidden" name="campaignId" value={campaignId} />
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="creatorId" value={id} />
        ))}

        <div className="max-h-[calc(100vh-13rem)] overflow-auto rounded-lg border">
          <table className="w-max min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-20 bg-muted text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-30 bg-muted px-2 py-2">
                  {canWrite ? (
                    <input
                      type="checkbox"
                      checked={allSelected}
                      disabled={selectableIds.length === 0}
                      onChange={toggleVisible}
                      aria-label="Seleccionar los que se pueden meter"
                      className="size-4 accent-primary"
                    />
                  ) : null}
                </th>
                {[
                  "Perfil",
                  "País",
                  "Tipo",
                  "Views IG",
                  "Tarifas básicas",
                  "En esta campaña",
                  "Formato",
                  "Piezas",
                  "Venta",
                  "Coste",
                  "Otras marcas",
                ].map((label, index) => (
                  <th
                    key={label}
                    className={
                      index === 0
                        ? "sticky left-8 z-30 bg-muted px-2 py-2 font-medium"
                        : "px-2 py-2 font-medium whitespace-nowrap"
                    }
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-3 py-8 text-sm text-muted-foreground"
                  >
                    Nadie coincide con ese filtro.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const checked = selected.has(row.id);
                  return (
                    <tr
                      key={row.id}
                      className="border-t hover:bg-muted/40"
                      data-handle={row.handle}
                    >
                      <td
                        className={`sticky left-0 z-10 px-2 py-1.5 ${checked ? "bg-muted" : "bg-background"}`}
                      >
                        {canWrite ? (
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!row.selectable}
                            onChange={() => toggle(row.id)}
                            aria-label={`Seleccionar @${row.handle}`}
                            className="size-4 accent-primary disabled:opacity-40"
                          />
                        ) : null}
                      </td>
                      <td
                        className={`sticky left-8 z-10 px-2 py-1.5 ${checked ? "bg-muted" : "bg-background"}`}
                      >
                        <Link
                          href={`/creators/${row.id}`}
                          className="font-medium underline underline-offset-4"
                        >
                          @{row.handle}
                        </Link>
                        {row.displayName ? (
                          <span className="mt-0.5 block text-muted-foreground">
                            {row.displayName}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {row.countryLabel}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {row.profileTypeLabel}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">
                        <span className="block">{row.viewsLabel}</span>
                        {row.viewsStale ? (
                          <Badge variant="outline" className="mt-0.5">
                            Actualizar
                          </Badge>
                        ) : row.viewsWhen ? (
                          <span className="block text-muted-foreground">
                            {row.viewsWhen}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-80 px-2 py-1.5 text-muted-foreground">
                        {row.quotesLabel}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {row.statusLabel}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        {row.formatLabel}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">{row.piecesLabel}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">
                        {row.saleLabel}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">
                        {row.costLabel}
                      </td>
                      <td className="max-w-64 px-2 py-1.5 text-muted-foreground">
                        {row.othersLabel}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {canWrite ? (
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
            <p className="text-sm">
              {selected.size === 0
                ? "Marca filas para meterlas en la campaña."
                : `${selected.size} ${selected.size === 1 ? "seleccionado" : "seleccionados"}`}
            </p>
            <Button type="submit" disabled={pickPending || selected.size === 0}>
              {pickPending
                ? "Metiendo…"
                : selected.size === 0
                  ? "Meter en la campaña"
                  : `Meter ${selected.size} en la campaña`}
            </Button>
          </div>
        ) : null}
      </form>

      {canWrite ? (
        <form key={pasteEpoch} action={pasteAction} className="grid gap-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <Label htmlFor="handles">Si no están en el roster, pégalos</Label>
          <textarea
            id="handles"
            name="handles"
            rows={2}
            placeholder={"@ana\nhttps://instagram.com/luis"}
            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm dark:bg-input/30"
          />
          <div>
            <Button type="submit" variant="outline" disabled={pastePending}>
              {pastePending ? "Metiendo…" : "Meter esta lista"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
