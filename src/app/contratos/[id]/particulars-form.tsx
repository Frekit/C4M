"use client";

import { useActionState } from "react";

import { FormErrorSummary } from "@/components/form-error-summary";
import { ParticularsNotesField } from "@/components/particulars-notes-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import {
  updateContractParticulars,
  type ContractActionResult,
} from "../actions";

export function ParticularsForm({
  contractId,
  notes,
  hasLiveSignature,
}: {
  contractId: string;
  notes?: string | null;
  hasLiveSignature: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    ContractActionResult | null,
    FormData
  >(updateContractParticulars, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="contractId" value={contractId} />

      <FormErrorSummary
        error={state?.error}
        fieldErrors={state?.fieldErrors}
        labels={{ notes: "Condiciones particulares" }}
      />

      {state?.ok && state.message ? (
        <Alert>
          <AlertTitle>Guardado</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {hasLiveSignature ? (
        <p className="text-xs text-muted-foreground">
          Hay un enlace de firma vivo. Si guardas, se revoca y tendrás que
          generar otro para que firme este PDF.
        </p>
      ) : null}

      <ParticularsNotesField
        defaultValue={notes}
        error={state?.fieldErrors?.notes}
      />

      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar particulares"}
      </Button>
    </form>
  );
}
