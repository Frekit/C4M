"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { StatusPill } from "@/components/status-pill";
import type { ContentRowData } from "@/lib/domain/contents";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { contentLabel, contentTone } from "./contents-labels";

export function ContentsDesktopTable({
  rows,
  selected,
  onSelectedChange,
  onOpen,
}: {
  rows: ContentRowData[];
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  onOpen: (row: ContentRowData) => void;
}) {
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
        cell: ({ row }) => (
          <StatusPill tone={contentTone(row.original)}>{contentLabel(row.original)}</StatusPill>
        ),
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
          <span className="max-w-[180px] truncate text-copy-12">{row.original.postUrl ?? "—"}</span>
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

  return (
    <div className="hidden min-[761px]:block">
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        selected={selected}
        onSelectedChange={onSelectedChange}
        onOpen={onOpen}
        showCards={false}
      />
    </div>
  );
}
