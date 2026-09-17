"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

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
import { SIGNATURE_FILTER_BATCH } from "@/lib/domain/enums";

import {
  sendFilterSignatures,
  type BulkSignatureResult,
} from "./actions";

export function ContractsBulkSignature({
  unsignedCount,
  campaignId,
  status,
}: {
  unsignedCount: number;
  campaignId?: string;
  status?: string;
}) {
  const [state, formAction, pending] = useActionState<
    BulkSignatureResult | null,
    FormData
  >(sendFilterSignatures, null);

  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
    if (state && !state.ok && state.error) toast.error(state.error);
  }, [state]);

  if (unsignedCount === 0) return null;

  const batch = Math.min(SIGNATURE_FILTER_BATCH, unsignedCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enviar a firma los del filtro</CardTitle>
        <CardDescription>
          Encola hasta {SIGNATURE_FILTER_BATCH} contratos en borrador o
          enviados. El correo sale a tandas; revisa el informe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="campana" value={campaignId ?? ""} />
          <input type="hidden" name="estado" value={status ?? ""} />
          <div className="grid gap-1.5">
            <Label htmlFor="expiresInDays">Caducidad (días)</Label>
            <Input
              id="expiresInDays"
              name="expiresInDays"
              type="number"
              min={1}
              max={90}
              defaultValue={14}
              className="w-24"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Encolando…" : `Encolar ${batch} firmas`}
          </Button>
        </form>
        {state?.ok ? (
          <p className="mt-3 text-sm text-muted-foreground">{state.message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
