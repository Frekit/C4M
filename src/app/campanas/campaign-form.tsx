"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { FormErrorSummary } from "@/components/form-error-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  budgetUsd: "Presupuesto",
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
  onCreated,
}: {
  clients: CampaignClientOption[];
  onCreated?: () => void;
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
    if (!state?.ok) return;
    toast.success("Campaña creada");
    onCreated?.();
  }, [state, onCreated]);

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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [newMode, setNewMode] = useState<SettlementMode>(
    SETTLEMENT_MODE.PER_CONTENT
  );
  const creatingClient = clientId === "__new__";

  return (
    <form action={formAction} noValidate className="grid gap-4">
      <FormErrorSummary
        error={state?.error}
        fieldErrors={state?.fieldErrors}
        labels={FIELD_LABELS}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Nombre de la campaña" error={state?.fieldErrors?.name}>
          <Input
            name="name"
            placeholder="Navidad 2026"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <div className="grid gap-2">
          <div className="flex justify-end">
            <Link
              href="/clientes"
              className="text-xs text-muted-foreground underline underline-offset-4"
            >
              Editar clientes
            </Link>
          </div>
        <Field
          id="clientId"
          label="Cliente"
          error={state?.fieldErrors?.clientId}
        >
          <select
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
        </Field>
        </div>

        {creatingClient ? (
          <>
            <Field
              id="newClientName"
              label="Nombre del cliente"
              error={state?.fieldErrors?.newClientName}
            >
              <Input name="newClientName" placeholder="Many Chat" required />
            </Field>

            <Field
              id="newSettlementMode"
              label="Cómo se liquida"
              description={SETTLEMENT_MODE_HINTS[newMode]}
            >
              <select
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
            </Field>

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

        <Field id="startsAt" label="Inicio (opcional)">
          <Input
            name="startsAt"
            type="date"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
          />
        </Field>

        <Field id="endsAt" label="Fin (opcional)" error={state?.fieldErrors?.endsAt}>
          <Input
            name="endsAt"
            type="date"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
          />
        </Field>

        <Field id="description" className="sm:col-span-2" label="Descripción (opcional)">
          <Textarea
            name="description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

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
  const [budget, setBudget] = useState(budgetUsd);
  const [termDays, setTermDays] = useState(String(paymentTermDays));

  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <Field
        id={`${idPrefix}engagementKind`}
        label="Tipo de encargo"
        description={CAMPAIGN_ENGAGEMENT_HINTS[kind]}
      >
        <select
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
      </Field>
      <Field
        id={`${idPrefix}approvalMode`}
        label="Aprobación"
        description={CAMPAIGN_APPROVAL_HINTS[approval]}
      >
        <select
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
      </Field>
      {kind === CAMPAIGN_ENGAGEMENT.BUDGET ? (
        <Field id={`${idPrefix}budgetUsd`} label="Presupuesto USD">
          <Input
            name="budgetUsd"
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            placeholder="50000"
          />
        </Field>
      ) : (
        <input type="hidden" name="budgetUsd" value="" />
      )}
      <Field id={`${idPrefix}defaultPaymentTermDays`} label="Plazo de pago (días)">
        <Input
          name="defaultPaymentTermDays"
          value={termDays}
          onChange={(event) => setTermDays(event.target.value)}
        />
      </Field>
    </div>
  );
}
