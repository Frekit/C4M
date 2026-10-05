"use client";

import { useActionState } from "react";

import { FormErrorSummary } from "@/components/form-error-summary";
import { NativeCheckboxField } from "@/components/native-checkbox-field";
import { NativeSelectField } from "@/components/native-select-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SETTLEMENT_MODE,
  SETTLEMENT_MODE_HINTS,
  SETTLEMENT_MODE_LABELS,
} from "@/lib/domain/enums";

import { updateClient, type ClientActionResult } from "../actions";

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  settlementMode: "Liquidación",
  notes: "Notas",
};

export function ClientForm({
  client,
}: {
  client: {
    id: string;
    name: string;
    settlementMode: string;
    requiresPlatformSubmit: boolean;
    notes: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState<
    ClientActionResult | null,
    FormData
  >(updateClient, null);

  return (
    <form action={formAction} noValidate className="grid gap-4">
      <input type="hidden" name="clientId" value={client.id} />

      <FormErrorSummary
        error={state?.error}
        fieldErrors={state?.fieldErrors}
        labels={FIELD_LABELS}
      />

      {state?.ok && state.message ? (
        <Alert>
          <AlertTitle>Guardado</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          defaultValue={client.name}
          required
          aria-invalid={Boolean(state?.fieldErrors?.name)}
        />
      </div>

      <NativeSelectField
        name="settlementMode"
        label="Cómo se liquida"
        defaultValue={client.settlementMode}
        options={Object.values(SETTLEMENT_MODE).map((mode) => ({
          value: mode,
          label: SETTLEMENT_MODE_LABELS[mode],
        }))}
        description={
          SETTLEMENT_MODE_HINTS[
            client.settlementMode as keyof typeof SETTLEMENT_MODE_HINTS
          ]
        }
        error={state?.fieldErrors?.settlementMode}
        required
      />

      <NativeCheckboxField
        name="requiresPlatformSubmit"
        title="Hay que subir los posts a una plataforma del cliente"
        description="Higgsfield sí. Many Chat no. Si lo quitas, los publicados pasan a la cola de pago sin pasar por la plataforma."
        defaultChecked={client.requiresPlatformSubmit}
      />

      <Alert>
        <AlertTitle>Afecta a contratos ya vivos</AlertTitle>
        <AlertDescription>
          Pack vs pieza y plataforma se leen del cliente ahora mismo: si
          cambias Many Chat a pieza a pieza, Finanzas deja de esperar al pack.
        </AlertDescription>
      </Alert>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notas internas (opcional)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={client.notes ?? ""}
        />
      </div>

      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar cliente"}
      </Button>
    </form>
  );
}
