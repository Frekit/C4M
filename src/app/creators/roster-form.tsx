"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { addRosterCreator, type RosterWriteResult } from "@/app/creators/roster-actions";
import { CatalogSelect } from "@/components/catalog-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/currencies";
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
          ? "Ese Instagram ya estaba. Actualicé tarifa, país o tipo."
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
      className="grid gap-3 sm:grid-cols-6 sm:items-end"
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
      <div className="grid gap-1.5">
        <Label htmlFor="defaultCost">Tarifa del creador</Label>
        <Input id="defaultCost" name="defaultCost" placeholder="120" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="defaultCostCurrency">Moneda</Label>
        <select
          id="defaultCostCurrency"
          name="defaultCostCurrency"
          defaultValue="EUR"
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        >
          {CURRENCIES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-6">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : "Añadir al roster"}
        </Button>
      </div>
    </form>
  );
}
