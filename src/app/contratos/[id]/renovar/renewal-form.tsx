"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { ContractEconomicsFields } from "@/components/contract-economics-fields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelectField } from "@/components/native-select-field";
import { CONTRACT_KIND } from "@/lib/domain/enums";

import { createRenewal, type ContractActionResult } from "../../actions";

type Mode = typeof CONTRACT_KIND.ANNEX | typeof CONTRACT_KIND.RENEWAL;

export type CampaignOption = {
  id: string;
  name: string;
  clientName: string | null;
  settlementLabel: string;
};

export function RenewalForm({
  parentId,
  parentCode,
  parentCostLabel,
  fxRates,
  defaults,
  campaigns,
  defaultCampaignId,
  campaignRequired = false,
  submitAnnexLabel = "Crear anexo",
  submitRenewalLabel = "Crear contrato de renovación",
}: {
  parentId: string;
  parentCode: string;
  parentCostLabel: string;
  fxRates: Record<string, number>;
  defaults: {
    deliverableCount: number;
    salePricePerContent: string;
    costCurrency: string;
    costPerContent: string;
    paymentTermDays: number;
  };
  campaigns: CampaignOption[];
  defaultCampaignId?: string;
  campaignRequired?: boolean;
  submitAnnexLabel?: string;
  submitRenewalLabel?: string;
}) {
  const [mode, setMode] = useState<Mode>(CONTRACT_KIND.ANNEX);
  const [state, formAction, pending] = useActionState<
    ContractActionResult | null,
    FormData
  >(createRenewal, null);

  return (
    <form action={formAction} className="grid gap-6">
      <input type="hidden" name="parentId" value={parentId} />
      <input type="hidden" name="mode" value={mode} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertTitle>No se ha podido crear</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>¿Qué cambia respecto a {parentCode}?</CardTitle>
          <CardDescription>
            De esto depende si basta un anexo o hace falta firmar un contrato
            nuevo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode(CONTRACT_KIND.ANNEX)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              mode === CONTRACT_KIND.ANNEX
                ? "border-primary bg-muted/40"
                : "hover:bg-muted/40"
            }`}
          >
            <p className="text-sm font-medium">Anexo</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Más contenidos al mismo coste ({parentCostLabel}). Se genera un
              documento que referencia al contrato original y deja el resto de
              condiciones intactas.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setMode(CONTRACT_KIND.RENEWAL)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              mode === CONTRACT_KIND.RENEWAL
                ? "border-primary bg-muted/40"
                : "hover:bg-muted/40"
            }`}
          >
            <p className="text-sm font-medium">Renovación</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cambia el coste del creator, la moneda o el plazo. Es un contrato
              nuevo y completo, enlazado al anterior en la misma cadena.
            </p>
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {mode === CONTRACT_KIND.ANNEX
              ? "Contenidos que se añaden"
              : "Nuevas condiciones"}
          </CardTitle>
          <CardDescription>
            {mode === CONTRACT_KIND.ANNEX
              ? "El coste por contenido queda fijado al del contrato original."
              : "Todo es editable, incluido el coste y la moneda de pago."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <NativeSelectField
            name="campaignId"
            label="Campaña"
            required={campaignRequired}
            defaultValue={defaultCampaignId ?? ""}
            error={state?.fieldErrors?.campaignId}
            description={
              campaignRequired
                ? "Los contenidos nuevos nacen ya dentro de esta campaña."
                : "Opcional. Solo campañas de este cliente."
            }
            options={[
              ...(campaignRequired
                ? []
                : [{ value: "", label: "Sin campaña todavía" }]),
              ...campaigns.map((campaign) => ({
                value: campaign.id,
                label: campaign.clientName
                  ? `${campaign.name} · ${campaign.clientName} · ${campaign.settlementLabel}`
                  : `${campaign.name} · ${campaign.settlementLabel}`,
              })),
            ]}
          />

          <ContractEconomicsFields
            key={mode}
            fxRates={fxRates}
            fieldErrors={state?.fieldErrors}
            defaults={defaults}
            lockCost={mode === CONTRACT_KIND.ANNEX}
            lockCostReason={`Fijado por ${parentCode}. Si tiene que cambiar, elige Renovación.`}
          />

          <div className="grid gap-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          nativeButton={false}
          render={<Link href={`/contratos/${parentId}`} />}
        >
          Volver al contrato
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending
            ? "Creando…"
            : mode === CONTRACT_KIND.ANNEX
              ? submitAnnexLabel
              : submitRenewalLabel}
        </Button>
      </div>
    </form>
  );
}
