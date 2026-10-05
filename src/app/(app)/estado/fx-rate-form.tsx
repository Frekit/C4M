"use client";

import { useActionState } from "react";

import { NativeSelectField } from "@/components/native-select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/currencies";

import { saveFxRate, type EstadoActionResult } from "./actions";

const CURRENCY_OPTIONS = CURRENCIES.filter((currency) => currency.code !== "USD").map(
  (currency) => ({
    value: currency.code,
    label: `${currency.code} · ${currency.name}`,
  })
);

export function FxRateForm() {
  const [state, formAction, pending] = useActionState<
    EstadoActionResult | null,
    FormData
  >(saveFxRate, null);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
      <NativeSelectField
        name="currency"
        label="Moneda"
        options={CURRENCY_OPTIONS}
        defaultValue="EUR"
        error={state?.fieldErrors?.currency}
        required
      />
      <div className="grid gap-2">
        <Label htmlFor="unitsPerUsd">Unidades por 1 USD</Label>
        <Input
          id="unitsPerUsd"
          name="unitsPerUsd"
          inputMode="decimal"
          placeholder="0.92"
          required
          aria-invalid={Boolean(state?.fieldErrors?.unitsPerUsd)}
        />
        {state?.fieldErrors?.unitsPerUsd ? (
          <p className="text-xs text-destructive">
            {state.fieldErrors.unitsPerUsd}
          </p>
        ) : null}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambio"}
      </Button>
      {state?.error ? (
        <p className="text-xs text-destructive sm:col-span-3">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-xs text-muted-foreground sm:col-span-3">
          Guardado para hoy (UTC). Los contratos ya creados no se mueven.
        </p>
      ) : null}
    </form>
  );
}
