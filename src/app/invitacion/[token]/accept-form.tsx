"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { acceptInvitation, type AcceptResult } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<
    AcceptResult | null,
    FormData
  >(acceptInvitation, null);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="grid gap-2">
        <Label htmlFor="name">Tu nombre</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Nombre y apellidos"
          required
          aria-invalid={Boolean(state?.fieldErrors?.name)}
        />
        {state?.fieldErrors?.name ? (
          <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
        ) : null}
      </div>

      {state?.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Entrando…" : "Aceptar invitación y entrar"}
      </Button>
    </form>
  );
}
