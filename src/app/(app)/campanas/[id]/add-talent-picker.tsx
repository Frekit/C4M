"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  addCreatorsToCampaign,
  pasteTalentToCampaign,
  type CampaignRosterResult,
} from "@/app/(app)/campanas/roster-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RosterPick } from "@/lib/domain/campaign-roster";
import type { RosterCatalog } from "@/lib/domain/roster-catalog";
import { labelForSlug } from "@/lib/domain/roster-labels";

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

export function AddTalentPicker({
  campaignId,
  picks,
  catalog,
}: {
  campaignId: string;
  picks: RosterPick[];
  catalog: RosterCatalog;
}) {
  const [pickState, pickAction, pickPending] = useActionState<
    CampaignRosterResult | null,
    FormData
  >(addCreatorsToCampaign, null);
  const [pasteState, pasteAction, pastePending] = useActionState<
    CampaignRosterResult | null,
    FormData
  >(pasteTalentToCampaign, null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pasteEpoch, setPasteEpoch] = useState(0);
  const [seenPick, setSeenPick] = useState(pickState);
  const [seenPaste, setSeenPaste] = useState(pasteState);

  if (pickState !== seenPick) {
    setSeenPick(pickState);
    if (pickState?.ok) setSelected(new Set());
  }

  if (pasteState !== seenPaste) {
    setSeenPaste(pasteState);
    if (pasteState?.ok) setPasteEpoch((epoch) => epoch + 1);
  }

  useEffect(() => {
    if (!pickState) return;
    resultToast(pickState);
  }, [pickState]);

  useEffect(() => {
    if (!pasteState) return;
    resultToast(pasteState);
  }, [pasteState]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return picks;
    return picks.filter((pick) => {
      const country = labelForSlug(catalog.countries, pick.country) ?? "";
      const type = labelForSlug(catalog.profileTypes, pick.profileType) ?? "";
      return [pick.handle, pick.displayName ?? "", country, type]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [catalog, picks, query]);

  const visibleIds = filtered.map((pick) => pick.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

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
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="grid gap-4">
      <form action={pickAction} className="grid gap-3">
        <input type="hidden" name="campaignId" value={campaignId} />
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="creatorId" value={id} />
        ))}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid min-w-48 flex-1 gap-1.5">
            <Label htmlFor="roster-search">Buscar en el roster</Label>
            <Input
              id="roster-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Handle, país o tipo"
            />
          </div>
          <Button type="submit" disabled={pickPending || selected.size === 0}>
            {pickPending
              ? "Metiendo…"
              : selected.size === 0
                ? "Meter en la campaña"
                : `Meter ${selected.size} en la campaña`}
          </Button>
        </div>

        {picks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No queda nadie del roster fuera de esta mesa. Pega handles abajo
            si falta alguien.
          </p>
        ) : (
          <div className="grid gap-2">
            {filtered.length > 0 ? (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleVisible}
                  className="size-4 accent-primary"
                />
                {allVisibleSelected
                  ? "Quitar la selección visible"
                  : `Seleccionar los ${filtered.length} que se ven`}
              </label>
            ) : null}
            <ul className="max-h-72 overflow-y-auto rounded-lg border">
              {filtered.length === 0 ? (
                <li className="px-3 py-4 text-sm text-muted-foreground">
                  Nadie coincide con esa búsqueda.
                </li>
              ) : (
                filtered.map((pick) => {
                  const country = labelForSlug(catalog.countries, pick.country);
                  const type = labelForSlug(catalog.profileTypes, pick.profileType);
                  const meta = [country, type].filter(Boolean).join(" · ");
                  return (
                    <li key={pick.id} className="border-b last:border-b-0">
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/40">
                        <input
                          type="checkbox"
                          checked={selected.has(pick.id)}
                          onChange={() => toggle(pick.id)}
                          className="size-4 accent-primary"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">
                            @{pick.handle}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {pick.displayName ? `${pick.displayName} · ` : ""}
                            {meta || "Sin país ni tipo"}
                            {pick.already === "active"
                              ? " · ya tuvo una pasada"
                              : pick.already === "rejected"
                                ? " · descartado antes"
                                : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </form>

      <form key={pasteEpoch} action={pasteAction} className="grid gap-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <Label htmlFor="handles">Si no están en el roster, pégalos</Label>
        <textarea
          id="handles"
          name="handles"
          rows={3}
          placeholder={"@ana\nhttps://instagram.com/luis\nsofia.tech"}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm dark:bg-input/30"
        />
        <div>
          <Button type="submit" variant="outline" disabled={pastePending}>
            {pastePending ? "Metiendo…" : "Meter esta lista"}
          </Button>
        </div>
      </form>
    </div>
  );
}
