"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { CampaignQueueGroup } from "@/lib/domain/finance-queues";

import {
  clearPlatformSubmitError,
  markClientSubmitted,
  type FinanceActionResult,
} from "./actions";

export function PlatformErrorQueue({
  groups,
}: {
  groups: CampaignQueueGroup[];
}) {
  if (groups.length === 0) return null;

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Error al subir: siguen publicados en redes. Cuando lo revises, vuélvelos
        a la cola o márcalos submitted.
      </p>
      {groups.map((group) => (
        <ErrorGroupCard key={group.key} group={group} />
      ))}
    </div>
  );
}

function ErrorGroupCard({ group }: { group: CampaignQueueGroup }) {
  const [submitState, submitAction, submitPending] = useActionState<
    FinanceActionResult | null,
    FormData
  >(markClientSubmitted, null);
  const [retryState, retryAction, retryPending] = useActionState<
    FinanceActionResult | null,
    FormData
  >(clearPlatformSubmitError, null);
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(group.items.map((item) => [item.id, true]))
  );

  useEffect(() => {
    if (submitState?.ok) {
      toast.success(
        submitState.count === 1
          ? "1 contenido marcado como subido a la plataforma"
          : `${submitState.count} contenidos marcados como subidos a la plataforma`
      );
    }
    if (submitState && !submitState.ok && submitState.error) {
      toast.error(submitState.error);
    }
  }, [submitState]);

  useEffect(() => {
    if (retryState?.ok) {
      toast.success(
        retryState.count === 1
          ? "1 contenido ha vuelto a la cola de subida"
          : `${retryState.count} contenidos han vuelto a la cola de subida`
      );
    }
    if (retryState && !retryState.ok && retryState.error) {
      toast.error(retryState.error);
    }
  }, [retryState]);

  const selectedItems = group.items.filter((item) => selected[item.id]);
  const busy = submitPending || retryPending;

  function toggleAll(next: boolean) {
    setSelected(Object.fromEntries(group.items.map((item) => [item.id, next])));
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-1">
          <CardTitle>{group.campaignName}</CardTitle>
          <CardDescription>
            {group.clientName ? `Cliente: ${group.clientName} · ` : null}
            {group.items.length}{" "}
            {group.items.length === 1 ? "con error" : "con error de subida"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-8 p-2">
                  <input
                    type="checkbox"
                    checked={
                      group.items.length > 0 &&
                      selectedItems.length === group.items.length
                    }
                    onChange={(event) => toggleAll(event.target.checked)}
                    aria-label="Seleccionar todos"
                    className="size-4 accent-primary"
                  />
                </th>
                <th className="p-2 font-medium">Creator</th>
                <th className="p-2 font-medium">Contrato</th>
                <th className="p-2 font-medium">Enlace</th>
                <th className="p-2 font-medium">Razón</th>
                <th className="p-2 font-medium text-right">Coste</th>
              </tr>
            </thead>
            <tbody>
              {group.items.map((item) => (
                <tr key={item.id} className="border-t align-top">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={Boolean(selected[item.id])}
                      onChange={(event) =>
                        setSelected((current) => ({
                          ...current,
                          [item.id]: event.target.checked,
                        }))
                      }
                      aria-label={`Seleccionar contenido ${item.position} de ${item.creatorHandle}`}
                      className="size-4 accent-primary"
                    />
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    @{item.creatorHandle}
                    <span className="block text-xs text-muted-foreground">
                      nº {item.position}
                      {item.platformSubmitErrorAt
                        ? ` · ${formatDate(item.platformSubmitErrorAt)}`
                        : ""}
                    </span>
                  </td>
                  <td className="p-2">
                    <a
                      href={`/contratos/${item.contractId}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {item.contractCode}
                    </a>
                  </td>
                  <td className="max-w-48 p-2">
                    <a
                      href={item.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-xs underline underline-offset-4"
                    >
                      {item.postUrl}
                    </a>
                  </td>
                  <td className="max-w-72 p-2 text-xs">
                    {item.platformSubmitError ?? "—"}
                  </td>
                  <td className="p-2 whitespace-nowrap text-right">
                    {formatMoney(item.costMinor, item.costCurrency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {selectedItems.length} seleccionados
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={retryAction}>
              {selectedItems.map((item) => (
                <input
                  key={item.id}
                  type="hidden"
                  name="deliverableIds"
                  value={item.id}
                />
              ))}
              <Button
                type="submit"
                variant="outline"
                disabled={busy || selectedItems.length === 0}
              >
                {retryPending ? "Devolviendo…" : "Volver a la cola"}
              </Button>
            </form>
            <form action={submitAction}>
              {selectedItems.map((item) => (
                <input
                  key={`sub-${item.id}`}
                  type="hidden"
                  name="deliverableIds"
                  value={item.id}
                />
              ))}
              <Button type="submit" disabled={busy || selectedItems.length === 0}>
                {submitPending
                  ? "Marcando…"
                  : "Ya están en la plataforma del cliente"}
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
