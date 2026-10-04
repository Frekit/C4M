"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  setCreatorRate,
  type RosterWriteResult,
} from "@/app/creators/roster-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/currencies";

export function CreatorRateForm({
  creatorId,
  amount,
  currency,
}: {
  creatorId: string;
  amount: string;
  currency: string;
}) {
  const [state, formAction, pending] = useActionState<
    RosterWriteResult | null,
    FormData
  >(setCreatorRate, null);

  useEffect(() => {
    if (state?.ok) toast.success("Tarifa del creador guardada.");
    else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      key={`${amount}|${currency}`}
      action={formAction}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="creatorId" value={creatorId} />
      <div className="grid gap-1">
        <Label htmlFor="defaultCost" className="text-xs">
          Importe
        </Label>
        <Input
          id="defaultCost"
          name="defaultCost"
          defaultValue={amount}
          placeholder="120"
          className="w-28"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="defaultCostCurrency" className="text-xs">
          Moneda
        </Label>
        <select
          id="defaultCostCurrency"
          name="defaultCostCurrency"
          defaultValue={currency || "EUR"}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        >
          {CURRENCIES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando…" : "Guardar tarifa"}
      </Button>
    </form>
  );
}
