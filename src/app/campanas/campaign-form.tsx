"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FormErrorSummary } from "@/components/form-error-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SETTLEMENT_MODE,
  SETTLEMENT_MODE_HINTS,
  SETTLEMENT_MODE_LABELS,
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
  const formRef = useRef<HTMLFormElement>(null);
  const [clientId, setClientId] = useState("");
  const [newMode, setNewMode] = useState<SettlementMode>(
    SETTLEMENT_MODE.PER_CONTENT
  );
  const [state, formAction, pending] = useActionState<
    CampaignActionResult | null,
    FormData
  >(createCampaign, null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setClientId("");
      setNewMode(SETTLEMENT_MODE.PER_CONTENT);
      toast.success("Campaña creada");
    }
  }, [state]);

  const creatingClient = clientId === "__new__";

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
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
          <Label htmlFor="clientId">Cliente</Label>
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
      </div>

      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Creando…" : "Crear campaña"}
      </Button>
    </form>
  );
}
