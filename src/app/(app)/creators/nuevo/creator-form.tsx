"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AtSignIcon } from "lucide-react";

import { ContractEconomicsFields } from "@/components/contract-economics-fields";
import { Field } from "@/components/field";
import { FormErrorSummary } from "@/components/form-error-summary";
import { ParticularsNotesField } from "@/components/particulars-notes-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { ClientCampaignFields, type CampaignChoice, type ClientOption } from "@/components/client-campaign-fields";

import { createCreatorWithContract, type CreateResult } from "../actions";

const FIELD_LABELS: Record<string, string> = {
  instagram: "Enlace de Instagram",
  displayName: "Nombre",
  contactEmail: "Email de contacto",
  deliverableCount: "Contenidos pactados",
  salePricePerContent: "Precio de venta por contenido",
  costCurrency: "Moneda de pago",
  costPerContent: "Coste por contenido",
  fxUnitsPerUsd: "Tipo de cambio",
  paymentTermDays: "Plazo de pago",
  notes: "Condiciones particulares",
  clientId: "Cliente",
  campaignId: "Campaña",
};

export function CreatorForm({
  fxRates,
  clients,
  campaigns,
}: {
  fxRates: Record<string, number>;
  clients: ClientOption[];
  campaigns: CampaignChoice[];
}) {
  const [state, formAction, pending] = useActionState<
    CreateResult | null,
    FormData
  >(createCreatorWithContract, null);

  return (
    <form action={formAction} noValidate className="grid gap-6">
      {state?.error ? (
        <Alert variant="destructive">
          <AlertTitle>No se ha podido registrar</AlertTitle>
          <AlertDescription>
            {state.error}
            {state.existingCreatorId ? (
              <Link
                href={`/creators/${state.existingCreatorId}`}
                className="ml-1 underline underline-offset-4"
              >
                Ir a su ficha
              </Link>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : (
        <FormErrorSummary fieldErrors={state?.fieldErrors} labels={FIELD_LABELS} />
      )}

      <Card>
        <CardHeader>
          <AtSignIcon className="size-4 text-muted-foreground" />
          <CardTitle>Quién es</CardTitle>
          <CardDescription>
            Con el enlace de Instagram basta; el resto ayuda a localizarle.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field
            id="instagram"
            className="sm:col-span-3"
            label="Enlace de Instagram o handle"
            error={state?.fieldErrors?.instagram}
          >
            <Input
              name="instagram"
              placeholder="https://www.instagram.com/handle"
              autoComplete="off"
              required
            />
          </Field>

          <Field id="displayName" className="sm:col-span-2" label="Nombre (opcional)">
            <Input name="displayName" autoComplete="off" />
          </Field>

          <Field
            id="contactEmail"
            label="Email de contacto (opcional)"
            error={state?.fieldErrors?.contactEmail}
          >
            <Input name="contactEmail" type="email" autoComplete="off" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lo pactado</CardTitle>
          <CardDescription>
            El contrato es de un cliente. Si luego entra Many Chat, se le abre
            otra cadena desde su ficha, no se mezcla con Higgsfield.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <ClientCampaignFields
            clients={clients}
            campaigns={campaigns}
            clientError={state?.fieldErrors?.clientId}
            campaignError={state?.fieldErrors?.campaignId}
          />

          <ContractEconomicsFields
            fxRates={fxRates}
            fieldErrors={state?.fieldErrors}
          />

          <ParticularsNotesField error={state?.fieldErrors?.notes} rows={4} />
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          nativeButton={false}
          render={<Link href="/creators" />}
        >
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creando contrato…" : "Registrar y generar contrato"}
        </Button>
      </div>
    </form>
  );
}
