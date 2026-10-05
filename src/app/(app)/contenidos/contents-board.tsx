"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useShell } from "@/components/shell-context";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DELIVERABLE_STATUS,
  DELIVERABLE_STATUS_LABELS,
  DELIVERABLE_STATUS_ORDER,
} from "@/lib/domain/enums";
import type { ContentRowData } from "@/lib/domain/contents";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

import { updateDeliverable } from "./actions";
import { contentLabel, contentTone } from "./contents-labels";
import type { ContentsDesktopTable } from "./contents-desktop-table";

export function ContentsBoard({
  rows,
  canEdit,
}: {
  rows: ContentRowData[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const shell = useShell();
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [DesktopTable, setDesktopTable] = useState<typeof ContentsDesktopTable | null>(null);
  const open = rows.find((row) => row.id === openId) ?? null;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 761px)");
    let alive = true;
    const load = () => {
      if (!media.matches) return;
      void import("./contents-desktop-table").then((mod) => {
        if (alive) setDesktopTable(() => mod.ContentsDesktopTable);
      });
    };
    load();
    media.addEventListener("change", load);
    return () => {
      alive = false;
      media.removeEventListener("change", load);
    };
  }, []);

  async function save(row: ContentRowData, patch: { postUrl?: string; contentDate?: string; status?: string }) {
    shell.setAutosave({ state: "saving" });
    const form = new FormData();
    form.set("deliverableId", row.id);
    form.set("campaignId", row.campaignId ?? "");
    form.set("status", patch.status ?? row.status);
    form.set("contentDate", patch.contentDate ?? row.contentDate ?? "");
    form.set("postUrl", patch.postUrl ?? row.postUrl ?? "");
    const result = await updateDeliverable(null, form);
    if (!result.ok) {
      shell.setAutosave({ state: "error", message: "No se guardó · Reintentar" });
      setError(result.fieldErrors?.postUrl ?? result.error ?? "No se ha guardado.");
      return;
    }
    setError(null);
    shell.setAutosave({ state: "saved", message: "Guardado" });
    router.refresh();
  }

  return (
    <>
      <ul className="grid gap-2 min-[761px]:hidden">
        {rows.map((row) => (
          <li key={row.id} className="min-h-[60px]">
            <button
              type="button"
              className="flex min-h-[60px] w-full items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 text-left"
              onClick={() => {
                setError(null);
                setOpenId(row.id);
              }}
            >
              <span>
                <span className="block text-label-13">
                  {row.title || `Contenido ${row.position}`}
                </span>
                <span className={cn("text-copy-12", row.isLate ? "text-danger" : "text-fg-subtle")}>
                  @{row.creatorHandle} · {row.contentDate ? formatDate(row.contentDate) : "sin fecha"}
                </span>
              </span>
              <StatusPill tone={contentTone(row)}>{contentLabel(row)}</StatusPill>
            </button>
          </li>
        ))}
      </ul>
      <div className="hidden min-[761px]:block" style={{ minHeight: 34 + rows.length * 44 }}>
        {DesktopTable ? (
          <DesktopTable
            rows={rows}
            selected={selected}
            onSelectedChange={setSelected}
            onOpen={(row) => {
              setError(null);
              setOpenId(row.id);
            }}
          />
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-primary px-3 py-2 text-primary-foreground shadow-(--e3) min-[761px]:bottom-6">
          <span className="text-label-13">{selected.length} seleccionados</span>
          <button type="button" className="px-2" aria-label="Quitar selección" onClick={() => setSelected([])}>
            ×
          </button>
        </div>
      ) : null}

      <Sheet open={Boolean(open)} onOpenChange={(value) => !value && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[440px]">
          {open ? (
            <>
              <SheetHeader>
                <SheetTitle>{open.title || `Contenido ${open.position}`}</SheetTitle>
              </SheetHeader>
              <div className="grid gap-3 px-4 pb-6">
                <p className="font-mono text-copy-12 text-fg-subtle">
                  <Link href={`/contratos/${open.contractId}`} className="hover:underline">
                    {open.contractCode}
                  </Link>
                  {" · "}@{open.creatorHandle}
                </p>
                <label className="grid gap-1 text-label-13">
                  Enlace de la publicación
                  <input
                    key={`${open.id}-url`}
                    defaultValue={open.postUrl ?? ""}
                    disabled={!canEdit}
                    onBlur={(event) => void save(open, { postUrl: event.target.value })}
                    className="h-9 rounded-md border border-input bg-card px-2 text-copy-14"
                  />
                </label>
                {error ? (
                  <p className="text-copy-13 text-danger">
                    {error}{" "}
                    <Link href="/contenidos?sinEnlace=1" className="underline">
                      Ir a ese contenido
                    </Link>
                  </p>
                ) : null}
                <label className="grid gap-1 text-label-13">
                  Fecha prevista
                  <input
                    key={`${open.id}-date`}
                    type="date"
                    defaultValue={open.contentDate ?? ""}
                    disabled={!canEdit}
                    onBlur={(event) => void save(open, { contentDate: event.target.value })}
                    className="h-9 rounded-md border border-input bg-card px-2 text-copy-14"
                  />
                  <span className="text-copy-12 text-fg-subtle">Al publicar se guarda la fecha real.</span>
                </label>
                <label className="grid gap-1 text-label-13">
                  Estado
                  <select
                    key={`${open.id}-status`}
                    defaultValue={open.status}
                    disabled={!canEdit}
                    onChange={(event) => void save(open, { status: event.target.value })}
                    className="h-9 rounded-md border border-input bg-card px-2 text-copy-14"
                  >
                    {DELIVERABLE_STATUS_ORDER.map((status) => (
                      <option key={status} value={status}>
                        {DELIVERABLE_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="text-copy-13">
                  Coste {formatMoney(open.costMinor, open.costCurrency)}
                </p>
                {canEdit && open.status !== DELIVERABLE_STATUS.PUBLISHED && open.status !== DELIVERABLE_STATUS.SUBMITTED ? (
                  <Button
                    data-primary="true"
                    onClick={() =>
                      void save(open, {
                        status: DELIVERABLE_STATUS.PUBLISHED,
                        contentDate: open.contentDate ?? new Date().toISOString().slice(0, 10),
                      })
                    }
                  >
                    Marcar como publicado
                  </Button>
                ) : null}
                <p className="text-copy-12 text-fg-subtle" role="status">
                  Guardado
                </p>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
