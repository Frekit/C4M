"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  removeFromCampaignDesk,
  setCampaignCuration,
} from "@/app/campanas/curation-actions";
import {
  addCreatorsToCampaign,
  pasteTalentToCampaign,
  type CampaignRosterResult,
} from "@/app/campanas/roster-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CampaignSheetRow, SheetRateLine } from "@/lib/domain/campaign-sheet";

const sectionLabel = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

function ratesByNetwork(rates: SheetRateLine[]) {
  const groups: { platform: string; lines: SheetRateLine[] }[] = [];
  for (const rate of rates) {
    const current = groups.find((group) => group.platform === rate.platformLabel);
    if (current) current.lines.push(rate);
    else groups.push({ platform: rate.platformLabel, lines: [rate] });
  }
  return groups;
}

function CurationPanel({
  row,
  campaignId,
  canWrite,
  marked,
  pending,
  onToggle,
  action,
  curateAction,
  removeAction,
  curatePending,
}: {
  row: CampaignSheetRow | null;
  campaignId: string;
  canWrite: boolean;
  marked: boolean;
  pending: boolean;
  onToggle: (id: string) => void;
  action: (payload: FormData) => void;
  curateAction: (payload: FormData) => void;
  removeAction: (payload: FormData) => void;
  curatePending: boolean;
}) {
  if (!row) {
    return (
      <aside
        id="curacion"
        className="rounded-lg border bg-card p-4 lg:sticky lg:top-4"
      >
        <h2 className={sectionLabel}>Curación</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Abre un perfil de la tabla. Aquí se ve la mediana, las tarifas por
          red y las marcas con las que ya ha trabajado, para decidir si entra.
        </p>
      </aside>
    );
  }

  const networks = ratesByNetwork(row.rates);
  const brands = row.others.slice(0, 6);
  const meta = [row.countryLabel, row.profileTypeLabel]
    .filter((part) => part && part !== "—")
    .join(" · ");
  const campaignLine =
    row.place === "out"
      ? "Todavía no está en la campaña."
      : row.place === "saved"
        ? "Apartado. Todavía no está en la campaña."
        : row.place === "dismissed"
          ? "No entra en esta campaña."
          : [row.formatLabel, row.piecesLabel !== "—" ? `${row.piecesLabel} piezas` : null, row.saleLabel, row.costLabel]
              .filter((part) => part && part !== "—")
              .join(" · ") || row.statusLabel;

  return (
    <aside
      id="curacion"
      className="grid gap-4 rounded-lg border bg-card p-4 lg:sticky lg:top-4"
    >
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-heading text-lg font-medium tracking-tight">@{row.handle}</h2>
          <Badge variant={row.place === "open" ? "default" : "outline"}>
            {row.statusLabel}
          </Badge>
        </div>
        {row.displayName ? (
          <p className="text-sm text-muted-foreground">{row.displayName}</p>
        ) : null}
        {meta ? <p className="text-xs text-muted-foreground">{meta}</p> : null}
      </div>

      <section className="grid gap-1">
        <h3 className={sectionLabel}>Views de Instagram</h3>
        <p className="font-heading text-3xl font-medium tabular-nums tracking-tight">
          {row.viewsLabel}
        </p>
        {row.viewsStale ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Hay que actualizar la mediana antes de fiarse del alcance.
          </p>
        ) : row.viewsWhen ? (
          <p className="text-xs text-muted-foreground">Anotada el {row.viewsWhen}</p>
        ) : null}
      </section>

      <section className="grid gap-2">
        <h3 className={sectionLabel}>Tarifas básicas</h3>
        {networks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin tarifas todavía.</p>
        ) : (
          networks.map((group) => (
            <div key={group.platform} className="grid gap-1">
              <p className="text-xs font-medium">{group.platform}</p>
              <ul className="grid gap-0.5">
                {group.lines.map((line) => (
                  <li
                    key={`${line.platform}-${line.packageLabel}-${line.amountLabel}`}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span>{line.packageLabel.replace(`${group.platform} · `, "")}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {line.amountLabel}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <section className="grid gap-1">
        <h3 className={sectionLabel}>En esta campaña</h3>
        <p className={`text-sm ${row.place === "out" || row.place === "saved" || row.place === "dismissed" ? "text-muted-foreground" : ""}`}>
          {campaignLine}
        </p>
        {row.place === "open" && !row.removable ? (
          <p className="text-xs text-muted-foreground">
            Esta línea ya está cerrada.
          </p>
        ) : null}
      </section>

      <section className="grid gap-1">
        <h3 className={sectionLabel}>Otras marcas</h3>
        {brands.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguna todavía.</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {brands.map((brand) => (
              <li key={brand}>{brand}</li>
            ))}
          </ul>
        )}
        {row.others.length > 6 ? (
          <Link
            href={`/creators/${row.id}`}
            className="text-sm underline underline-offset-4"
          >
            Ver todas
          </Link>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2">
        {canWrite && row.removable ? (
          <form action={removeAction}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="creatorId" value={row.id} />
            <Button type="submit" variant="outline" disabled={curatePending}>
              Quitar de la campaña
            </Button>
          </form>
        ) : null}
        {canWrite && row.selectable ? (
          <form action={action}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="creatorId" value={row.id} />
            <Button type="submit" disabled={pending}>
              {pending ? "Metiendo…" : "Meter en la campaña"}
            </Button>
          </form>
        ) : null}
        {canWrite ? (
          <form action={curateAction}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="creatorId" value={row.id} />
            <input type="hidden" name="stance" value="SAVED" />
            <Button
              type="submit"
              variant={row.place === "saved" ? "secondary" : "outline"}
              disabled={curatePending || row.place === "saved"}
            >
              Apartar
            </Button>
          </form>
        ) : null}
        {canWrite ? (
          <form action={curateAction}>
            <input type="hidden" name="campaignId" value={campaignId} />
            <input type="hidden" name="creatorId" value={row.id} />
            <input type="hidden" name="stance" value="DISMISSED" />
            <Button
              type="submit"
              variant="ghost"
              disabled={curatePending || row.place === "dismissed"}
            >
              Descartar
            </Button>
          </form>
        ) : null}
        {canWrite && row.selectable ? (
          <Button type="button" variant="outline" onClick={() => onToggle(row.id)}>
            {marked ? "Quitar del lote" : "Sumar al lote"}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href={`/creators/${row.id}`} />}
        >
          Abrir ficha
        </Button>
      </div>
    </aside>
  );
}

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
  const [curateState, curateAction, curatePending] = useActionState<
    CampaignRosterResult | null,
    FormData
  >(setCampaignCuration, null);
  const [removeState, removeAction, removePending] = useActionState<
    CampaignRosterResult | null,
    FormData
  >(removeFromCampaignDesk, null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!curateState) return;
    if (curateState.ok) toast.success("Curación guardada.");
    else if (curateState.error) toast.error(curateState.error);
  }, [curateState]);

  useEffect(() => {
    if (!removeState) return;
    if (removeState.ok) toast.success("Fuera de la campaña.");
    else if (removeState.error) toast.error(removeState.error);
  }, [removeState]);

  const openRow = rows.find((row) => row.id === openId) ?? null;

  useEffect(() => {
    if (!openId) return;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    document.getElementById("curacion")?.scrollIntoView({ block: "start" });
  }, [openId]);

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
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <form action={pickAction} className="grid min-w-0 gap-3">
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
                  const active = openId === row.id;
                  const stickyBg = checked || active ? "bg-muted" : "bg-background";
                  return (
                    <tr
                      key={row.id}
                      data-handle={row.handle}
                      data-open={active ? "true" : "false"}
                      tabIndex={0}
                      onClick={() => setOpenId(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") setOpenId(row.id);
                      }}
                      className={`cursor-pointer border-t hover:bg-muted/40 ${active ? "bg-muted/60" : ""}`}
                    >
                      <td
                        className={`sticky left-0 z-10 px-2 py-1.5 ${stickyBg}`}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
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
                      <td className={`sticky left-8 z-10 px-2 py-1.5 ${stickyBg}`}>
                        <Link
                          href={`/creators/${row.id}`}
                          onClick={(event) => event.stopPropagation()}
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
      <CurationPanel
        row={openRow}
        campaignId={campaignId}
        canWrite={canWrite}
        marked={openRow ? selected.has(openRow.id) : false}
        pending={pickPending}
        onToggle={toggle}
        action={pickAction}
        curateAction={curateAction}
        removeAction={removeAction}
        curatePending={curatePending || removePending}
      />
      </div>

      {canWrite ? (
        <details className="rounded-lg border px-3 py-2">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            No está en el roster
          </summary>
          <form key={pasteEpoch} action={pasteAction} className="mt-3 grid gap-2">
            <input type="hidden" name="campaignId" value={campaignId} />
            <Label htmlFor="handles">Pega los que todavía no tenemos</Label>
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
        </details>
      ) : null}
    </div>
  );
}
