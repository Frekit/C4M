"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  addRosterOptionAliases,
  createRosterOption,
  type CatalogWriteResult,
} from "@/app/creators/catalog-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RosterOptionKind } from "@/lib/domain/roster-catalog";

function useCatalogToast(state: CatalogWriteResult | null) {
  useEffect(() => {
    if (state?.ok) toast.success("Catálogo actualizado.");
    if (state && !state.ok && state.error) toast.error(state.error);
  }, [state]);
}

export function AddCatalogOptionForm({
  kind,
  noun,
}: {
  kind: RosterOptionKind;
  noun: string;
}) {
  const [state, formAction, pending] = useActionState<
    CatalogWriteResult | null,
    FormData
  >(createRosterOption, null);
  useCatalogToast(state);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-1.5">
        <Label htmlFor={`${kind}-label`}>Nombre</Label>
        <Input
          id={`${kind}-label`}
          name="label"
          required
          placeholder={noun}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${kind}-aliases`}>Alias del Excel</Label>
        <Input
          id={`${kind}-aliases`}
          name="aliases"
          placeholder="españa, es, spain"
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : `Añadir ${noun.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}

export function AddAliasesForm({ optionId }: { optionId: string }) {
  const [state, formAction, pending] = useActionState<
    CatalogWriteResult | null,
    FormData
  >(addRosterOptionAliases, null);
  useCatalogToast(state);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="optionId" value={optionId} />
      <Input
        name="aliases"
        placeholder="más alias, separados por coma"
        className="w-56"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : "Añadir alias"}
      </Button>
    </form>
  );
}
