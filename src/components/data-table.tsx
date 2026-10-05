"use client";

import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";

import { useHotkeys } from "@/hooks/use-hotkeys";
import { cn } from "@/lib/utils";

export function DataTable<T>({
  data,
  columns,
  getRowId,
  onOpen,
  selected,
  onSelectedChange,
  empty,
  card,
  showCards = true,
}: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  getRowId: (row: T) => string;
  onOpen?: (row: T) => void;
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  empty?: React.ReactNode;
  card?: (row: T) => React.ReactNode;
  showCards?: boolean;
}) {
  const [focus, setFocus] = useState(0);
  const [anchor, setAnchor] = useState(0);
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => getRowId(row),
  });
  const rows = table.getRowModel().rows;

  function toggle(id: string) {
    onSelectedChange(
      selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]
    );
  }

  function selectRange(index: number) {
    const start = Math.min(anchor, index);
    const end = Math.max(anchor, index);
    const ids = rows.slice(start, end + 1).map((row) => row.id);
    onSelectedChange([...new Set([...selected, ...ids])]);
  }

  useHotkeys({
    j: (event) => {
      if (rows.length === 0) return;
      event.preventDefault();
      setFocus((value) => Math.min(value + 1, rows.length - 1));
    },
    k: (event) => {
      if (rows.length === 0) return;
      event.preventDefault();
      setFocus((value) => Math.max(value - 1, 0));
    },
    Enter: (event) => {
      const row = rows[focus];
      if (!row || !onOpen) return;
      event.preventDefault();
      onOpen(row.original);
    },
    x: (event) => {
      const row = rows[focus];
      if (!row) return;
      event.preventDefault();
      toggle(row.id);
    },
  });

  if (rows.length === 0) {
    return <div className="px-4 py-10">{empty}</div>;
  }

  return (
    <>
      <div className="hidden overflow-auto min-[761px]:block">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-muted text-label-12 text-muted-foreground">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="h-[34px]">
                {group.headers.map((header) => (
                  <th key={header.id} className="px-2 font-normal">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const active = index === focus;
              const isSelected = selected.includes(row.id);
              return (
                <tr
                  key={row.id}
                  tabIndex={active ? 0 : -1}
                  data-state={isSelected ? "selected" : undefined}
                  className={cn(
                    "h-11 border-t border-border outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                    isSelected && "bg-brand-muted/70",
                    active && "bg-muted/60"
                  )}
                  onClick={(event) => {
                    setFocus(index);
                    if (event.shiftKey) {
                      selectRange(index);
                      return;
                    }
                    onOpen?.(row.original);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === " ") {
                      event.preventDefault();
                      toggle(row.id);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell, cellIndex) => (
                    <td key={cell.id} className="px-2 text-copy-13">
                      {cellIndex === 0 ? (
                        <input
                          type="checkbox"
                          aria-label="Seleccionar fila"
                          checked={isSelected}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (event.shiftKey) selectRange(index);
                            else {
                              setAnchor(index);
                              toggle(row.id);
                            }
                          }}
                          onChange={() => undefined}
                        />
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showCards ? <ul className="grid gap-2 min-[761px]:hidden">
        {rows.map((row) => (
          <li key={row.id} className="min-h-[60px]">
            <button
              type="button"
              className="flex min-h-[60px] w-full items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 text-left"
              onClick={() => onOpen?.(row.original)}
            >
              {card ? card(row.original) : <span>{row.id}</span>}
            </button>
          </li>
        ))}
      </ul> : null}
    </>
  );
}
