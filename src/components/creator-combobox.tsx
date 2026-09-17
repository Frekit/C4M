"use client";

import { useEffect, useId, useRef, useState } from "react";

type CreatorOption = {
  id: string;
  handle: string;
  displayName?: string | null;
};

export function CreatorCombobox({
  name = "creador",
  selected,
}: {
  name?: string;
  selected?: CreatorOption | null;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<CreatorOption | null>(selected ?? null);
  const [items, setItems] = useState<CreatorOption[]>([]);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setPicked(selected ?? null);
  }, [selected]);

  useEffect(() => {
    if (picked || query.trim().length < 1) {
      setItems([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/creators/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { items?: CreatorOption[] };
        setItems(payload.items ?? []);
        setOpen(true);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setItems([]);
        }
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [picked, query]);

  return (
    <div className="relative grid gap-1.5">
      <input type="hidden" name={name} value={picked?.id ?? ""} />
      {picked ? (
        <div className="flex h-8 items-center justify-between gap-2 rounded-lg border border-input px-2 text-sm dark:bg-input/30">
          <span className="truncate">
            @{picked.handle}
            {picked.displayName ? (
              <span className="text-muted-foreground"> · {picked.displayName}</span>
            ) : null}
          </span>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setPicked(null);
              setQuery("");
              setItems([]);
            }}
          >
            Quitar
          </button>
        </div>
      ) : (
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => items.length > 0 && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder="Buscar handle…"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={listId}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      )}
      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md"
        >
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                className="flex w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setPicked(item);
                  setQuery("");
                  setOpen(false);
                }}
              >
                @{item.handle}
                {item.displayName ? (
                  <span className="ml-2 text-muted-foreground">
                    {item.displayName}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
