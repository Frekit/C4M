"use client";

import { useActionState } from "react";
import { SendIcon } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { SelectField } from "@/components/select-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { RECIPIENT_KIND } from "@/lib/domain/enums";

import { sendToSignature, type ContractActionResult } from "../actions";

export function SendSignatureCard({
  contractId,
  baseUrl,
  defaultEmail,
}: {
  contractId: string;
  baseUrl: string;
  defaultEmail?: string | null;
}) {
  const [state, formAction, pending] = useActionState<
    ContractActionResult | null,
    FormData
  >(sendToSignature, null);

  const signatureUrl = state?.signatureUrl
    ? `${baseUrl}${state.signatureUrl}`
    : null;

  return (
    <Card>
      <CardHeader>
        <SendIcon className="size-4 text-muted-foreground" />
        <CardTitle>Enviar a firma</CardTitle>
        <CardDescription>
          Se genera un enlace privado donde el talento o su agencia rellenan sus
          datos y firman.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {signatureUrl ? (
          <Alert>
            <AlertTitle>Enlace de firma listo</AlertTitle>
            <AlertDescription className="grid gap-2">
              <code className="rounded bg-muted px-2 py-1 text-xs break-all">
                {signatureUrl}
              </code>
              <div>
                <CopyButton value={signatureUrl} />
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {state?.error ? (
          <Alert variant="destructive">
            <AlertTitle>No se ha podido generar</AlertTitle>
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="contractId" value={contractId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="recipientEmail">Email de quien firma</Label>
              <Input
                id="recipientEmail"
                name="recipientEmail"
                type="email"
                defaultValue={defaultEmail ?? ""}
                required
                aria-invalid={Boolean(state?.fieldErrors?.recipientEmail)}
              />
              {state?.fieldErrors?.recipientEmail ? (
                <p className="text-xs text-destructive">
                  {state.fieldErrors.recipientEmail}
                </p>
              ) : null}
            </div>

            <SelectField
              name="recipientKind"
              label="Firma"
              options={[
                { value: RECIPIENT_KIND.TALENT, label: "El propio talento" },
                { value: RECIPIENT_KIND.AGENCY, label: "Su agencia o management" },
              ]}
              defaultValue={RECIPIENT_KIND.TALENT}
            />
          </div>

          <div className="grid gap-2 sm:max-w-48">
            <Label htmlFor="expiresInDays">Caduca en (días)</Label>
            <Input
              id="expiresInDays"
              name="expiresInDays"
              type="number"
              min={1}
              max={90}
              defaultValue={14}
            />
          </div>

          <Button type="submit" className="w-fit" disabled={pending}>
            {pending ? "Generando…" : "Generar enlace de firma"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
