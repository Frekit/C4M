"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { FormErrorSummary } from "@/components/form-error-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CAMPAIGN_APPROVAL,
  CAMPAIGN_APPROVAL_HINTS,
  CAMPAIGN_APPROVAL_LABELS,
  CAMPAIGN_ENGAGEMENT,
  CAMPAIGN_ENGAGEMENT_HINTS,
  CAMPAIGN_ENGAGEMENT_LABELS,
  SETTLEMENT_MODE,
  SETTLEMENT_MODE_HINTS,
  SETTLEMENT_MODE_LABELS,
  type CampaignApproval,
  type CampaignEngagement,
  type SettlementMode,
} from "@/lib/domain/enums";

import { createCampaign, type CampaignActionResult } from "./actions";

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  clientId: "Cliente",
  newClientName: "Nuevo cliente",
  description: "Descripción",
  startsAt: "Inicio",
  endsAt: "Fin",
};

export type CampaignClientOption = {
  id: string;
  name: string;
  settlementMode: string;
  requiresPlatformSubmit: boolean;
};

const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function CampaignForm({
  clients,
}: {
  clients: CampaignClientOption[];
}) {
  const [state, formAction, pending] = useActionState<
    CampaignActionResult | null,
    FormData
  >(createCampaign, null);
  const [formEpoch, setFormEpoch] = useState(0);
  const [seenState, setSeenState] = useState(state);

  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setFormEpoch((epoch) => epoch + 1);
  }

  useEffect(() => {
    if (state?.ok) toast.success("Campaña creada");
  }, [state]);

  return (
    <CampaignFields
      key={formEpoch}
      clients={clients}
      state={state?.ok ? null : state}
      formAction={formAction}
      pending={pending}
    />
  );
}

function CampaignFields({
  clients,
  state,
  formAction,
  pending,
}: {
  clients: CampaignClientOption[];
  state: CampaignActionResult | null;
  formAction: (payload: FormData) => void;
  pending: boolean;
}) {
  const [clientId, setClientId] = useState("");
  const [newMode, setNewMode] = useState<SettlementMode>(
    SETTLEMENT_MODE.PER_CONTENT
  );
  const creatingClient = clientId === "__new__";

  return (
    <form action={formAction} className="grid gap-4">
      <FormErrorSummary
        error={state?.error}
        fieldErrors={state?.fieldErrors}
        labels={FIELD_LABELS}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Nombre de la campaña</Label>
          <Input
            id="name"
            name="name"
            placeholder="Navidad 2026"
            required
            aria-invalid={Boolean(state?.fieldErrors?.name)}
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="clientId">Cliente</Label>
            <Link
              href="/clientes"
              className="text-xs text-muted-foreground underline underline-offset-4"
            >
              Editar clientes
            </Link>
          </div>
          <select
            id="clientId"
            name="clientId"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className={inputClass}
          >
            <option value="">Sin cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
                {client.settlementMode === SETTLEMENT_MODE.PACK
                  ? " · pack"
                  : client.requiresPlatformSubmit
                    ? " · plataforma"
                    : ""}
              </option>
            ))}
            <option value="__new__">Nuevo cliente…</option>
          </select>
        </div>

        {creatingClient ? (
          <>
            <div className="grid gap-2">
              <Label htmlFor="newClientName">Nombre del cliente</Label>
              <Input
                id="newClientName"
                name="newClientName"
                placeholder="Many Chat"
                required
                aria-invalid={Boolean(state?.fieldErrors?.newClientName)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="newSettlementMode">Cómo se liquida</Label>
              <select
                id="newSettlementMode"
                name="newSettlementMode"
                className={inputClass}
                value={newMode}
                onChange={(event) =>
                  setNewMode(event.target.value as SettlementMode)
                }
              >
                {Object.values(SETTLEMENT_MODE).map((mode) => (
                  <option key={mode} value={mode}>
                    {SETTLEMENT_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {SETTLEMENT_MODE_HINTS[newMode]}
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                name="newRequiresPlatformSubmit"
                value="1"
                key={newMode}
                defaultChecked={newMode === SETTLEMENT_MODE.PER_CONTENT}
                className="size-4 accent-primary"
              />
              Hay que subir los posts a una plataforma del cliente
            </label>
          </>
        ) : (
          <input type="hidden" name="newClientName" value="" />
        )}

        <div className="grid gap-2">
          <Label htmlFor="startsAt">Inicio (opcional)</Label>
          <Input id="startsAt" name="startsAt" type="date" />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="endsAt">Fin (opcional)</Label>
          <Input
            id="endsAt"
            name="endsAt"
            type="date"
            aria-invalid={Boolean(state?.fieldErrors?.endsAt)}
          />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="description">Descripción (opcional)</Label>
          <Textarea id="description" name="description" rows={2} />
        </div>

        <CampaignPolicyFields />
      </div>

      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Creando…" : "Crear campaña"}
      </Button>
    </form>
  );
}

export function CampaignPolicyFields({
  idPrefix = "",
  engagementKind = CAMPAIGN_ENGAGEMENT.ALWAYS_ON,
  approvalMode = CAMPAIGN_APPROVAL.INTERNAL,
  budgetUsd = "",
  paymentTermDays = 30,
}: {
  idPrefix?: string;
  engagementKind?: CampaignEngagement;
  approvalMode?: CampaignApproval;
  budgetUsd?: string;
  paymentTermDays?: number;
}) {
  const [kind, setKind] = useState<CampaignEngagement>(engagementKind);
  const [approval, setApproval] = useState<CampaignApproval>(approvalMode);

  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}engagementKind`}>Tipo de encargo</Label>
        <select
          id={`${idPrefix}engagementKind`}
          name="engagementKind"
          className={inputClass}
          value={kind}
          onChange={(event) =>
            setKind(event.target.value as CampaignEngagement)
          }
        >
          {Object.values(CAMPAIGN_ENGAGEMENT).map((value) => (
            <option key={value} value={value}>
              {CAMPAIGN_ENGAGEMENT_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {CAMPAIGN_ENGAGEMENT_HINTS[kind]}
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}approvalMode`}>Aprobación</Label>
        <select
          id={`${idPrefix}approvalMode`}
          name="approvalMode"
          className={inputClass}
          value={approval}
          onChange={(event) =>
            setApproval(event.target.value as CampaignApproval)
          }
        >
          {Object.values(CAMPAIGN_APPROVAL).map((value) => (
            <option key={value} value={value}>
              {CAMPAIGN_APPROVAL_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {CAMPAIGN_APPROVAL_HINTS[approval]}
        </p>
      </div>
      {kind === CAMPAIGN_ENGAGEMENT.BUDGET ? (
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}budgetUsd`}>Presupuesto USD</Label>
          <Input
            id={`${idPrefix}budgetUsd`}
            name="budgetUsd"
            defaultValue={budgetUsd}
            placeholder="50000"
          />
        </div>
      ) : (
        <input type="hidden" name="budgetUsd" value="" />
      )}
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}defaultPaymentTermDays`}>
          Plazo de pago (días)
        </Label>
        <Input
          id={`${idPrefix}defaultPaymentTermDays`}
          name="defaultPaymentTermDays"
          defaultValue={String(paymentTermDays)}
        />
      </div>
    </div>
  );
}
