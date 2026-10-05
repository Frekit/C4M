"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  ClientCampaignFields,
  type CampaignChoice,
  type ClientOption,
} from "@/components/client-campaign-fields";
import { ContractEconomicsFields } from "@/components/contract-economics-fields";
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

import {
  createClientContract,
  type ContractActionResult,
} from "@/app/contratos/actions";

const FIELD_LABELS: Record<string, string> = {
  clientId: "Cliente",
  campaignId: "Campaña",
  deliverableCount: "Contenidos",
  salePricePerContent: "Precio de venta",
  costCurrency: "Moneda",
  costPerContent: "Coste",
  fxUnitsPerUsd: "Tipo de cambio",
  paymentTermDays: "Plazo de pago",
};

export function NewClientContractForm({
  creatorId,
  handle,
  clients,
  campaigns,
  fxRates,
  defaults,
}: {
  creatorId: string;
  handle: string;
  clients: ClientOption[];
  campaigns: CampaignChoice[];
  fxRates: Record<string, number>;
  defaults: {
    deliverableCount: number;
    salePricePerContent: string;
    costCurrency: string;
    costPerContent: string;
    paymentTermDays: number;
  };
}) {
  const [state, formAction, pending] = useActionState<
    ContractActionResult | null,
    FormData
  >(createClientContract, null);

  if (clients.length === 0) {
    return (
      <Alert>
        <AlertTitle>Ya está con todos los clientes</AlertTitle>
        <AlertDescription>
          Para más contenidos de un cliente que ya tiene, amplía o renueva ese
          contrato desde su ficha.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={formAction} noValidate className="grid gap-6">
      <input type="hidden" name="creatorId" value={creatorId} />
      <FormErrorSummary
        error={state?.error}
        fieldErrors={state?.fieldErrors}
        labels={FIELD_LABELS}
      />

      <Card>
        <CardHeader>
          <CardTitle>Cliente nuevo para @{handle}</CardTitle>
          <CardDescription>
            Es un contrato original, no un anexo de Higgsfield. Many Chat (u
            otro) tiene su propia cadena y su propia liquidación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClientCampaignFields
            clients={clients}
            campaigns={campaigns}
            clientError={state?.fieldErrors?.clientId}
            campaignError={state?.fieldErrors?.campaignId}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contenidos de este cliente</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <ContractEconomicsFields
            fxRates={fxRates}
            fieldErrors={state?.fieldErrors}
            defaults={defaults}
          />
          <ParticularsNotesField error={state?.fieldErrors?.notes} rows={4} />
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          nativeButton={false}
          render={<Link href={`/creators/${creatorId}`} />}
        >
          Volver a la ficha
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creando…" : "Crear contrato con este cliente"}
        </Button>
      </div>
    </form>
  );
}
