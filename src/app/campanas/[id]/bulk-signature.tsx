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

import {
  processPendingMail,
  sendCampaignSignatures,
  type BulkSignatureResult,
} from "../actions";

export function CampaignBulkSignature({
  campaignId,
  unsignedCount,
}: {
  campaignId: string;
  unsignedCount: number;
}) {
  const [state, formAction, pending] = useActionState<
    BulkSignatureResult | null,
    FormData
  >(sendCampaignSignatures, null);
  const [mailState, mailAction, mailPending] = useActionState<
    BulkSignatureResult | null,
    FormData
  >(processPendingMail, null);

  useEffect(() => {
    if (state?.ok && state.message) toast.success(state.message);
    if (state && !state.ok && state.error) toast.error(state.error);
  }, [state]);

  useEffect(() => {
    if (mailState?.ok && mailState.message) toast.success(mailState.message);
    if (mailState && !mailState.ok && mailState.error) {
      toast.error(mailState.error);
    }
  }, [mailState]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enviar a firma</CardTitle>
        <CardDescription>
          Encola los contratos de esta campaña que están en borrador o enviados
          y tienen email de contacto. El correo sale a tandas de 20.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {unsignedCount} contratos sin firmar en esta campaña.
        </p>
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="campaignId" value={campaignId} />
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
          <Button type="submit" disabled={pending || unsignedCount === 0}>
            {pending ? "Encolando…" : "Encolar firmas de la campaña"}
          </Button>
        </form>
        <form action={mailAction}>
          <Button type="submit" variant="outline" disabled={mailPending}>
            {mailPending ? "Enviando…" : "Procesar cola de correo"}
          </Button>
        </form>
        {state?.ok ? (
          <p className="text-sm text-muted-foreground">{state.message}</p>
        ) : null}
        {mailState?.ok ? (
          <p className="text-sm text-muted-foreground">{mailState.message}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
