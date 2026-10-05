"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
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
  type DeliverableStatus,
} from "@/lib/domain/enums";
import type { ContentRowData } from "@/lib/domain/contents";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

import { updateDeliverable } from "./actions";

function toneFor(row: ContentRowData) {
  if (row.platformSubmitError || row.isLate) return "destructive" as const;
  if (row.status === "PUBLISHED" || row.status === "SUBMITTED") return "success" as const;
  if (row.status === "SCHEDULED") return "info" as const;
  return "neutral" as const;
}

function labelFor(row: ContentRowData) {
  if (row.paidAt) return "Pagado";
  if (row.platformSubmitError) return "Rechazado por plataforma";
  if (row.isLate) return "Fecha pasada";
  return DELIVERABLE_STATUS_LABELS[row.status as DeliverableStatus] ?? row.status;
}

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
  const open = rows.find((row) => row.id === openId) ?? null;

  const columns = useMemo<ColumnDef<ContentRowData, unknown>[]>(
    () => [
      { id: "select", header: () => <span className="sr-only">Seleccionar</span> },
      {
        id: "contenido",
        header: "Contenido",
        cell: ({ row }) => (
          <span>
            <span className="text-label-13">
              {row.original.title || `Contenido ${row.original.position}`}
            </span>
            <span className="mt-0.5 block font-mono text-copy-12 text-fg-subtle">
              {row.original.contractCode}
            </span>
          </span>
        ),
      },
      {
        id: "creator",
        header: "Creator",
        cell: ({ row }) => <span>@{row.original.creatorHandle}</span>,
      },
      {
        id: "estado",
        header: "Estado",
        cell: ({ row }) => <StatusPill tone={toneFor(row.original)}>{labelFor(row.original)}</StatusPill>,
      },
      {
        id: "fecha",
        header: "Fecha",
        cell: ({ row }) => (
          <span className={cn(row.original.isLate && "text-danger")}>
            {row.original.contentDate ? formatDate(row.original.contentDate) : "—"}
          </span>
        ),
      },
      {
        id: "enlace",
        header: "Enlace",
        cell: ({ row }) => (
          <span className="max-w-[180px] truncate text-copy-12">
            {row.original.postUrl ?? "—"}
          </span>
        ),
      },
      {
        id: "pago",
        header: "Pago",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.paidAt
              ? "Pagado"
              : row.original.paymentDueAt
                ? formatDate(row.original.paymentDueAt)
                : "—"}
          </span>
        ),
      },
    ],
    []
  );

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
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        selected={selected}
        onSelectedChange={setSelected}
        onOpen={(row) => {
          setError(null);
          setOpenId(row.id);
        }}
        card={(row) => (
          <span className="flex w-full items-center justify-between gap-3">
            <span>
              <span className="block text-label-13">
                {row.title || `Contenido ${row.position}`}
              </span>
              <span className={cn("text-copy-12", row.isLate ? "text-danger" : "text-fg-subtle")}>
                @{row.creatorHandle} · {row.contentDate ? formatDate(row.contentDate) : "sin fecha"}
              </span>
            </span>
            <StatusPill tone={toneFor(row)}>{labelFor(row)}</StatusPill>
          </span>
        )}
      />

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
