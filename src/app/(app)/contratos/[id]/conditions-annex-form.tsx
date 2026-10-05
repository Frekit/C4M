"use client";

import { useActionState } from "react";

import { FormErrorSummary } from "@/components/form-error-summary";
import { ParticularsNotesField } from "@/components/particulars-notes-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  createConditionsAnnex,
  type ContractActionResult,
} from "../actions";

export function ConditionsAnnexForm({
  parentId,
  parentCode,
}: {
  parentId: string;
  parentCode: string;
}) {
  const [state, formAction, pending] = useActionState<
    ContractActionResult | null,
    FormData
  >(createConditionsAnnex, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Anexo de condiciones</CardTitle>
        <CardDescription>
          {parentCode} ya está firmado: el PDF no se reescribe. Este anexo
          mantiene contenidos e importes y pide una firma nueva sobre las
          cláusulas pactadas con este talento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate className="grid gap-4">
          <input type="hidden" name="parentId" value={parentId} />

          <FormErrorSummary
            error={state?.error}
            fieldErrors={state?.fieldErrors}
            labels={{ notes: "Condiciones particulares" }}
          />

          <ParticularsNotesField
            required
            error={state?.fieldErrors?.notes}
            rows={8}
          />

          <Button type="submit" className="w-fit" disabled={pending}>
            {pending ? "Creando anexo…" : "Crear anexo de condiciones"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
