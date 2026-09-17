"use client";

import { useState } from "react";

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

import { cancelContract, deleteContract } from "../actions";

export function DangerZone({
  contractId,
  canDelete,
  blockReason,
}: {
  contractId: string;
  canDelete: boolean;
  blockReason: string | null;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cancelar o borrar</CardTitle>
        <CardDescription>
          {canDelete
            ? "Este contrato todavía no tiene firma ni contenidos publicados, así que puede borrarse del todo."
            : blockReason}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {confirming ? (
          <form action={cancelContract} className="grid gap-3">
            <input type="hidden" name="contractId" value={contractId} />
            <div className="grid gap-2">
              <Label htmlFor="reason">Motivo de la cancelación</Label>
              <Input
                id="reason"
                name="reason"
                placeholder="El creator se ha caído del proyecto…"
              />
              <p className="text-xs text-muted-foreground">
                El contrato conserva su historial y sus importes: queda cancelado,
                no desaparece.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="destructive">
                Confirmar cancelación
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirming(false)}
              >
                Dejarlo como está
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirming(true)}
            >
              Cancelar contrato
            </Button>

            {canDelete ? (
              <form action={deleteContract}>
                <input type="hidden" name="contractId" value={contractId} />
                <Button type="submit" variant="ghost">
                  Borrar borrador
                </Button>
              </form>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
