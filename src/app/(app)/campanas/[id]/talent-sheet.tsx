"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  activateCampaignTalent,
  pasteTalentToCampaign,
  saveCampaignTalentPrices,
} from "@/app/(app)/campanas/roster-actions";
import { BrandIcon, type BrandName } from "@/components/brand-icon";
import { PageHeader, PageTab, PageTabs } from "@/components/page-shell";
import { useShell } from "@/components/shell-context";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { costPackageLabel, isCostPlatform } from "@/lib/domain/creator-cost-quote";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TALENT_STATUS,
  CAMPAIGN_TALENT_STATUS_LABELS,
  SIGNATURE_STATUS_LABELS,
  type CampaignStatus,
  type CampaignTalentStatus,
  type SignatureStatus,
} from "@/lib/domain/enums";
import type { PlanillaRow } from "@/lib/domain/campaign-planilla";
import { formatMoney, formatPercent, fromMinorUnits } from "@/lib/money";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { cn } from "@/lib/utils";

function usd(cents: number) {
  return `US$ ${new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)}`;
}

function PlanillaKpis({ rows, published }: { rows: PlanillaRow[]; published: number }) {
  const active = rows.filter((row) => row.status !== "REJECTED");
  const sale = active.reduce((sum, row) => sum + (row.saleCents ?? 0) * (row.count ?? 1), 0);
  const committed = active
    .filter((row) => row.status === "ACTIVE" || row.status === "APPROVED")
    .reduce((sum, row) => sum + (row.saleCents ?? 0) * (row.count ?? 1), 0);
  const margins = active.map((row) => row.margin).filter((value): value is number => value != null);
  const margin = margins.length
    ? margins.reduce((sum, value) => sum + value, 0) / margins.length
    : null;
  const ratio = sale > 0 ? Math.round((committed / sale) * 100) : 0;
  return (
    <div className="grid overflow-hidden rounded-xl border border-border sm:grid-cols-2 xl:grid-cols-4">
      <div className="border-border px-4 py-3.5 not-last:border-b sm:not-last:border-r xl:not-last:border-b-0">
        <p className="text-copy-12 text-fg-subtle">Presupuesto de venta</p>
        <p className="text-heading-20 tabular-nums">{usd(sale)}</p>
      </div>
      <div className="border-border px-4 py-3.5 not-last:border-b sm:nth-[2n]:border-r-0 sm:not-last:border-r xl:border-r xl:not-last:border-b-0">
        <p className="text-copy-12 text-fg-subtle">Venta comprometida</p>
        <p className="text-heading-20 tabular-nums">{usd(committed)}</p>
        <p className="text-copy-12 text-muted-foreground">{ratio} %</p>
      </div>
      <div className="border-border px-4 py-3.5 not-last:border-b sm:not-last:border-r xl:border-r xl:not-last:border-b-0">
        <p className="text-copy-12 text-fg-subtle">Margen medio</p>
        <p className="text-heading-20 tabular-nums">{margin == null ? "—" : formatPercent(margin)}</p>
      </div>
      <div className="px-4 py-3.5">
        <p className="text-copy-12 text-fg-subtle">Publicados</p>
        <p className="text-heading-20 tabular-nums">{published}</p>
      </div>
    </div>
  );
}

function platformBrand(value: string | null): BrandName | null {
  if (value === "IG" || value === "INSTAGRAM") return "instagram";
  if (value === "TT" || value === "TIKTOK") return "tiktok";
  if (value === "YT" || value === "YOUTUBE") return "youtube";
  return null;
}

export function TalentSheet({
  campaignId,
  campaignName,
  status,
  clientName,
  starts,
  ends,
  rows,
  published,
  canWrite,
}: {
  campaignId: string;
  campaignName: string;
  status: string;
  clientName: string | null;
  starts: string | null;
  ends: string | null;
  rows: PlanillaRow[];
  published: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const shell = useShell();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [focus, setFocus] = useState(0);
  const [adding, setAdding] = useState(false);
  const [handles, setHandles] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.status === "REJECTED" && needle.length === 0) return false;
      if (!needle) return true;
      return (
        row.handle.toLowerCase().includes(needle) ||
        (row.name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [query, rows]);

  useHotkeys({
    "/": (event) => {
      event.preventDefault();
      document.getElementById("planilla-filtro")?.focus();
    },
    j: (event) => {
      event.preventDefault();
      setFocus((value) => Math.min(value + 1, Math.max(visible.length - 1, 0)));
    },
    k: (event) => {
      event.preventDefault();
      setFocus((value) => Math.max(value - 1, 0));
    },
    x: (event) => {
      const row = visible[focus];
      if (!row) return;
      event.preventDefault();
      setSelected((current) =>
        current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id]
      );
    },
  });

  async function generateContract(talentId: string) {
    const form = new FormData();
    form.set("talentId", talentId);
    try {
      await activateCampaignTalent(form);
      setFlash(talentId);
      toast("Contrato generado");
      router.refresh();
    } catch (error) {
      toast.error("No se ha guardado", {
        description:
          error instanceof Error ? error.message : "No se pudo generar el contrato.",
      });
    }
  }

  async function saveCell(row: PlanillaRow, patch: { cost?: string; sale?: string; count?: string }) {
    shell.setAutosave({ state: "saving" });
    const costMajor =
      patch.cost ??
      (row.costMinor != null ? String(fromMinorUnits(row.costMinor, row.currency)) : "");
    const saleMajor =
      patch.sale ?? (row.saleCents != null ? String(row.saleCents / 100) : "");
    const form = new FormData();
    form.set("talentId", row.id);
    form.set("saleUsd", saleMajor);
    form.set("cost", costMajor);
    form.set("currency", row.currency);
    form.set("deliverableCount", patch.count ?? (row.count ? String(row.count) : ""));
    if (row.platform) form.set("contentPlatform", row.platform);
    if (row.format) form.set("contentFormat", row.format);
    const result = await saveCampaignTalentPrices(null, form);
    if (!result.ok) {
      shell.setAutosave({ state: "error", message: "No se guardó · Reintentar" });
      toast.error("No se ha guardado", { description: result.error });
      return;
    }
    shell.setAutosave({ state: "saved", message: "Guardado" });
    router.refresh();
  }

  const totals = visible.reduce(
    (acc, row) => {
      acc.count += row.count ?? 0;
      acc.sale += (row.saleCents ?? 0) * (row.count ?? 1);
      return acc;
    },
    { count: 0, sale: 0 }
  );

  return (
    <div className="grid gap-4">
      <PageHeader
        title={campaignName}
        status={
          <StatusPill tone={status === "ACTIVE" ? "info" : "neutral"}>
            {CAMPAIGN_STATUS_LABELS[status as CampaignStatus] ?? status}
          </StatusPill>
        }
        meta={
          <>
            {clientName ? <span>{clientName}</span> : <span>Sin cliente</span>}
            {starts || ends ? (
              <span>
                {starts ?? "—"} – {ends ?? "—"}
              </span>
            ) : null}
          </>
        }
        secondary={
          <Button variant="outline" nativeButton={false} render={<Link href={`/campanas/${campaignId}?vista=mesa`} />}>
            Compartir con cliente
          </Button>
        }
        primary={
          canWrite ? (
            <Button data-primary="true" onClick={() => setAdding(true)}>
              Añadir perfil
            </Button>
          ) : null
        }
        tabs={
          <PageTabs>
            <PageTab href={`/campanas/${campaignId}`} active>
              Planilla {rows.filter((row) => row.status !== "REJECTED").length}
            </PageTab>
            <PageTab href={`/campanas/${campaignId}?vista=mesa`}>Mesa</PageTab>
            <PageTab href={`/campanas/${campaignId}?vista=mesa#contratos`}>Contratos</PageTab>
            <PageTab href="/contenidos">Contenidos</PageTab>
            <PageTab href={`/campanas/${campaignId}?vista=mesa#hilo`}>Hilo</PageTab>
            <PageTab href={`/campanas/${campaignId}?vista=mesa#brief`}>Brief</PageTab>
          </PageTabs>
        }
      />

      <PlanillaKpis rows={rows} published={published} />

      <div className="flex flex-wrap items-center gap-2">
        <input
          id="planilla-filtro"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filtrar creators…"
          className="h-8 w-56 rounded-md border border-input bg-card px-2 text-copy-14"
        />
        <span className="text-copy-12 text-fg-subtle">{visible.length} en la planilla</span>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-input px-6 py-8 text-center">
          <h2 className="font-serif text-[22px] leading-7">La planilla está vacía</h2>
          <p className="mt-1 text-copy-13 text-muted-foreground">
            Añade perfiles a mano o importa un Excel con los handles de Instagram.
          </p>
          {canWrite ? (
            <Button className="mt-4" onClick={() => setAdding(true)}>
              Añadir perfil
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-auto rounded-xl border bg-card">
          <table className="w-full min-w-[880px] text-left">
            <thead className="sticky top-0 bg-muted text-label-12 text-muted-foreground">
              <tr className="h-[34px]">
                <th className="px-2">
                  <span className="sr-only">Seleccionar</span>
                </th>
                <th className="px-2">Creator</th>
                <th className="px-2">Mediana</th>
                <th className="px-2">Contenidos</th>
                <th className="px-2 text-right">Coste</th>
                <th className="px-2 text-right">Venta</th>
                <th className="px-2 text-right">Margen</th>
                <th className="px-2">Estado</th>
                <th className="px-2">Contrato</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => {
                const brand = platformBrand(row.platform);
                const active = index === focus;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "h-11 border-t border-border",
                      selected.includes(row.id) && "bg-brand-muted/70",
                      (flash === row.id || shell.aiFlash.includes(row.handle.replace(/^@/, ""))) &&
                        "bg-ai-muted",
                      active && "outline outline-1 outline-ring"
                    )}
                  >
                    <td className="px-2">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar @${row.handle}`}
                        checked={selected.includes(row.id)}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(row.id)
                              ? current.filter((id) => id !== row.id)
                              : [...current, row.id]
                          )
                        }
                      />
                    </td>
                    <td className="px-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden
                          className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-medium"
                        >
                          {(row.name || row.handle).slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <Link href={`/creators/${row.creatorId}`} className="block text-label-13">
                            {row.name || `@${row.handle}`}
                          </Link>
                          <span className="inline-flex items-center gap-1 text-copy-12 text-fg-subtle">
                            {brand ? <BrandIcon brand={brand} /> : null}@{row.handle}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className="px-2 tabular-nums text-copy-13">
                      {row.views == null ? "—" : new Intl.NumberFormat("es-ES").format(row.views)}
                    </td>
                    <td className="px-2 text-copy-13">
                      {row.count
                        ? row.platform && row.format && isCostPlatform(row.platform)
                          ? costPackageLabel(row.platform, row.format, row.count)
                          : `${row.count} × ${row.format ?? "piezas"}`
                        : "—"}
                    </td>
                    <td className="px-2 text-right">
                      {canWrite && !row.frozen ? (
                        <input
                          aria-label={`Coste de @${row.handle}`}
                          defaultValue={
                            row.costMinor == null ? "" : String(fromMinorUnits(row.costMinor, row.currency))
                          }
                          onBlur={(event) => {
                            if (event.target.value === "" && row.costMinor == null) return;
                            void saveCell(row, { cost: event.target.value });
                          }}
                          className="h-8 w-28 rounded-md border border-transparent bg-transparent text-right tabular-nums focus:border-ring"
                        />
                      ) : (
                        <span className="tabular-nums text-copy-13">
                          {row.costMinor == null ? "—" : formatMoney(row.costMinor * (row.count ?? 1), row.currency)}
                        </span>
                      )}
                    </td>
                    <td className="px-2 text-right">
                      {canWrite && !row.frozen ? (
                        <input
                          aria-label={`Venta de @${row.handle}`}
                          defaultValue={row.saleCents == null ? "" : String(row.saleCents / 100)}
                          onBlur={(event) => void saveCell(row, { sale: event.target.value })}
                          className="h-8 w-28 rounded-md border border-transparent bg-transparent text-right tabular-nums focus:border-ring"
                        />
                      ) : (
                        <span className="tabular-nums text-copy-13">
                          {row.saleCents == null ? "—" : usd(row.saleCents * (row.count ?? 1))}
                        </span>
                      )}
                    </td>
                    <td className="px-2 text-right tabular-nums text-copy-13">
                      {row.margin == null ? "—" : formatPercent(row.margin)}
                    </td>
                    <td className="px-2">
                      <StatusPill
                        tone={
                          row.status === "REJECTED"
                            ? "destructive"
                            : row.status === "APPROVED" || row.status === "ACTIVE"
                              ? "success"
                              : row.status === "PROPOSED"
                                ? "info"
                                : "neutral"
                        }
                      >
                        {CAMPAIGN_TALENT_STATUS_LABELS[row.status as CampaignTalentStatus] ?? row.status}
                      </StatusPill>
                    </td>
                    <td className="px-2 text-copy-12">
                      {row.contractId ? (
                        <span className="inline-flex flex-col">
                          <Link href={`/contratos/${row.contractId}`} className="font-mono">
                            {row.contractCode}
                          </Link>
                          {row.signatureStatus ? (
                            <span className="text-fg-subtle">
                              {SIGNATURE_STATUS_LABELS[row.signatureStatus as SignatureStatus] ??
                                row.signatureStatus}
                            </span>
                          ) : row.contractStatus === "SIGNED" ? (
                            <span className="text-success">Firmado</span>
                          ) : null}
                        </span>
                      ) : row.status === CAMPAIGN_TALENT_STATUS.APPROVED && canWrite ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void generateContract(row.id)}
                        >
                          Generar contrato
                        </Button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted text-label-13">
                <td className="px-2 py-2" colSpan={3}>
                  {visible.length} creators
                </td>
                <td className="px-2 tabular-nums">{totals.count} contenidos</td>
                <td />
                <td className="px-2 text-right tabular-nums">{usd(totals.sale)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {selected.length > 0 ? (
        <div className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-primary px-3 py-2 text-primary-foreground shadow-(--e3) min-[761px]:bottom-6">
          <span className="text-label-13">{selected.length} seleccionados</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const approved = rows.filter(
                (row) => selected.includes(row.id) && row.status === CAMPAIGN_TALENT_STATUS.APPROVED
              );
              void (async () => {
                try {
                  for (const row of approved) {
                    const form = new FormData();
                    form.set("talentId", row.id);
                    await activateCampaignTalent(form);
                  }
                  toast("Generar contratos", {
                    description: `${approved.length} perfiles aprobados`,
                  });
                  setSelected([]);
                  router.refresh();
                } catch (error) {
                  toast.error("No se ha guardado", {
                    description:
                      error instanceof Error
                        ? error.message
                        : "No se pudieron generar los contratos.",
                  });
                }
              })();
            }}
          >
            Generar contratos
          </Button>
          <button type="button" className="px-2" onClick={() => setSelected([])} aria-label="Quitar selección">
            ×
          </button>
        </div>
      ) : null}

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent className="w-full sm:max-w-[440px]">
          <SheetHeader>
            <SheetTitle>Añadir perfil</SheetTitle>
          </SheetHeader>
          <form
            className="grid gap-3 px-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData();
              form.set("campaignId", campaignId);
              form.set("handles", handles);
              void pasteTalentToCampaign(null, form).then((result) => {
                if (!result.ok) {
                  toast.error("No se ha guardado", { description: result.error });
                  return;
                }
                toast(`Perfil añadido a ${campaignName}`);
                setAdding(false);
                setHandles("");
                router.refresh();
              });
            }}
          >
            <label className="grid gap-1 text-label-13">
              Handles de Instagram
              <textarea
                value={handles}
                onChange={(event) => setHandles(event.target.value)}
                rows={5}
                placeholder={"@martamoda\n@lauratravels"}
                className="rounded-md border border-input bg-card px-2 py-2 text-copy-14"
              />
            </label>
            <p className="text-copy-12 text-fg-subtle">Se añaden a esta campaña.</p>
            <Button type="submit">Añadir a la planilla</Button>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
