"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { SelectField } from "@/components/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, ROLES } from "@/lib/domain/enums";

import { inviteMember, type ActionResult } from "./actions";

const ROLE_OPTIONS = Object.values(ROLES).map((role) => ({
  value: role,
  label: ROLE_LABELS[role],
}));

export function InviteForm({ baseUrl }: { baseUrl: string }) {
  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(inviteMember, null);

  useEffect(() => {
    if (state?.ok && state.invitationUrl) {
      const url = `${baseUrl}${state.invitationUrl}`;
      navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success("Invitación creada", {
        description: "El enlace está copiado en tu portapapeles.",
      });
    }

    if (state && !state.ok && state.error) {
      toast.error(state.error);
    }
  }, [state, baseUrl]);

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="nombre@empresa.com"
          required
          aria-invalid={Boolean(state?.fieldErrors?.email)}
        />
        {state?.fieldErrors?.email ? (
          <p className="text-xs text-destructive">{state.fieldErrors.email}</p>
        ) : null}
      </div>

      <div className="sm:w-56">
        <SelectField
          name="role"
          label="Rol"
          options={ROLE_OPTIONS}
          defaultValue={ROLES.CREATORS}
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Creando…" : "Invitar"}
      </Button>
    </form>
  );
}
