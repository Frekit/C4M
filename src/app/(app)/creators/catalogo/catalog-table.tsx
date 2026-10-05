"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";

export function CatalogOptionsTable({
  options,
}: {
  options: { id: string; label: string; aliases: string[]; archived: boolean }[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const columns = useMemo<ColumnDef<(typeof options)[number], unknown>[]>(
    () => [
      { id: "select", header: "" },
      { accessorKey: "label", header: "Nombre" },
      {
        id: "aliases",
        header: "Alias",
        cell: ({ row }) => row.original.aliases.join(", ") || "—",
      },
      {
        id: "estado",
        header: "Estado",
        cell: ({ row }) => (row.original.archived ? "Archivado" : "Activo"),
      },
    ],
    []
  );

  return (
    <DataTable
      data={options}
      columns={columns}
      getRowId={(row) => row.id}
      selected={selected}
      onSelectedChange={setSelected}
    />
  );
}
