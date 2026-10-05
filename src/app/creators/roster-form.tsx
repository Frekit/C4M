"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { addRosterCreator, type RosterWriteResult } from "@/app/creators/roster-actions";
import { CatalogSelect } from "@/components/catalog-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RosterCatalog } from "@/lib/domain/roster-catalog";

export function RosterCreatorForm({ catalog }: { catalog: RosterCatalog }) {
  const [state, formAction, pending] = useActionState<
    RosterWriteResult | null,
    FormData
  >(addRosterCreator, null);

  const [formEpoch, setFormEpoch] = useState(0);

  useEffect(() => {
    if (state?.ok && (state.created ?? 0) > 0) {
      toast.success("Perfil añadido al roster.");
      setFormEpoch((epoch) => epoch + 1);
    } else if (state?.ok) {
      toast.message(
        state.updated
          ? "Ese Instagram ya estaba. Actualicé país, tipo o la mediana de views."
          : "Ese Instagram ya estaba. No había nada nuevo que guardar."
      );
      setFormEpoch((epoch) => epoch + 1);
    }
    if (state && !state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      key={formEpoch}
      action={formAction}
      className="grid gap-3 sm:grid-cols-4 sm:items-end"
    >
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="instagram">Instagram</Label>
        <Input
          id="instagram"
          name="instagram"
          required
          placeholder="@handle o url"
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="country">País</Label>
        <CatalogSelect
          id="country"
          name="country"
          options={catalog.countries}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="profileType">Tipo de perfil</Label>
        <CatalogSelect
          id="profileType"
          name="profileType"
          options={catalog.profileTypes}
        />
      </div>
      <div className="grid gap-1.5 sm:col-span-2">
        <Label htmlFor="igMedianViews">Mediana de views (IG)</Label>
        <Input
          id="igMedianViews"
          name="igMedianViews"
          inputMode="numeric"
          required
          placeholder="12.500"
        />
        <p className="text-xs text-muted-foreground">
          Se anota con la fecha de hoy. A los 15 días avisamos para
          actualizarla.
        </p>
      </div>
      <div className="sm:col-span-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Añadir al roster"}
        </Button>
      </div>
    </form>
  );
}
