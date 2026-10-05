"use client";

import { useState } from "react";
import Link from "next/link";
import { useActionState } from "react";

import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RECIPIENT_KIND } from "@/lib/domain/enums";

import { revokeSignature, sendToSignature, type ContractActionResult } from "../actions";

export function ContractCta({
  status,
  contractId,
  canSend,
  canRenew,
  blockReason,
  defaultEmail,
  signatureUrl,
  requestId,
  renewHref,
  pdfHref,
  contentsHref,
}: {
  status: string;
  contractId: string;
  canSend: boolean;
  canRenew: boolean;
  blockReason: string | null;
  defaultEmail: string | null;
  signatureUrl: string | null;
  requestId: string | null;
  renewHref: string;
  pdfHref: string;
  contentsHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ContractActionResult | null, FormData>(
    sendToSignature,
    null
  );

  if (status === "CANCELLED") {
    return (
      <p className="text-copy-13 text-muted-foreground">
        Este contrato está cancelado. No hay un duplicado automático en el dominio.
      </p>
    );
  }

  if (status === "COMPLETED" || status === "RENEWED") {
    return (
      <>
        <Button variant="outline" nativeButton={false} render={<a href={pdfHref} />}>
          Descargar PDF
        </Button>
        {canRenew ? (
          <Button data-primary="true" data-contract-primary="true" nativeButton={false} render={<Link href={renewHref} />}>
            Renovar
          </Button>
        ) : null}
      </>
    );
  }

  if (status === "SIGNED") {
    return (
      <>
        <Button variant="outline" nativeButton={false} render={<a href={pdfHref} />}>
          Descargar PDF firmado
        </Button>
        <Button
          data-primary="true"
          data-contract-primary="true"
          nativeButton={false}
          render={<Link href={contentsHref} />}
        >
          Marcar contenido publicado
        </Button>
      </>
    );
  }

  const sendLabel = status === "SENT" ? "Reenviar enlace" : "Enviar para firma";

  return (
    <>
      {status === "SENT" && signatureUrl ? <CopyButton value={signatureUrl} /> : null}
      {status === "SENT" && requestId && canSend ? (
        <form action={revokeSignature}>
          <input type="hidden" name="requestId" value={requestId} />
          <Button type="submit" variant="outline">
            Revocar
          </Button>
        </form>
      ) : null}
      {status === "DRAFT" ? (
        <Button variant="outline" nativeButton={false} render={<a href={pdfHref} target="_blank" rel="noreferrer" />}>
          Vista previa
        </Button>
      ) : null}
      {canSend ? (
        blockReason ? (
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Button data-primary="true" data-contract-primary="true" aria-disabled="true" disabled>
                {sendLabel}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{blockReason}</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            data-primary="true"
            data-contract-primary="true"
            onClick={() => setOpen(true)}
          >
            {sendLabel}
          </Button>
        )
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{sendLabel}</DialogTitle>
            <DialogDescription>
              El enlace caduca a los días que indiques. Quien firma lo abre sin entrar en C4M.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="grid gap-3">
            <input type="hidden" name="contractId" value={contractId} />
            <input type="hidden" name="recipientKind" value={RECIPIENT_KIND.TALENT} />
            <div className="grid gap-1.5">
              <Label htmlFor="recipientEmail">Email de quien firma</Label>
              <Input
                id="recipientEmail"
                name="recipientEmail"
                type="email"
                required
                defaultValue={defaultEmail ?? ""}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="expiresInDays">Días de validez del enlace</Label>
              <Input id="expiresInDays" name="expiresInDays" type="number" min={1} max={90} defaultValue={14} />
            </div>
            {state?.error ? <p className="text-copy-13 text-danger">{state.error}</p> : null}
            {state?.ok ? <p className="text-copy-13 text-success">Contrato enviado.</p> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Enviando…" : sendLabel}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
