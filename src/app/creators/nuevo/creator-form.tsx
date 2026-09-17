"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AtSignIcon } from "lucide-react";

import { ContractEconomicsFields } from "@/components/contract-economics-fields";
import { FormErrorSummary } from "@/components/form-error-summary";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
  notes: "Notas",
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
    <form action={formAction} className="grid gap-6">
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
          <div className="grid gap-2 sm:col-span-3">
            <Label htmlFor="instagram">Enlace de Instagram o handle</Label>
            <Input
              id="instagram"
              name="instagram"
              placeholder="https://www.instagram.com/handle"
              autoComplete="off"
              aria-invalid={Boolean(state?.fieldErrors?.instagram)}
              required
            />
            {state?.fieldErrors?.instagram ? (
              <p className="text-xs text-destructive">
                {state.fieldErrors.instagram}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="displayName">Nombre (opcional)</Label>
            <Input id="displayName" name="displayName" autoComplete="off" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="contactEmail">Email de contacto (opcional)</Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              autoComplete="off"
              aria-invalid={Boolean(state?.fieldErrors?.contactEmail)}
            />
          </div>
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

          <div className="grid gap-2">
            <Label htmlFor="notes">Notas del acuerdo (opcional)</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Formato, plazos de entrega, exclusividad, usos…"
            />
            <p className="text-xs text-muted-foreground">
              Se incluyen en el contrato como condiciones particulares.
            </p>
          </div>
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
