"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { FormErrorSummary } from "@/components/form-error-summary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createCampaign, type CampaignActionResult } from "./actions";

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  clientName: "Cliente",
  description: "Descripción",
  startsAt: "Inicio",
  endsAt: "Fin",
};

export function CampaignForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    CampaignActionResult | null,
    FormData
  >(createCampaign, null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      toast.success("Campaña creada");
    }
  }, [state]);

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
          <Label htmlFor="clientName">Cliente (opcional)</Label>
          <Input id="clientName" name="clientName" placeholder="Marca X" />
        </div>

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
