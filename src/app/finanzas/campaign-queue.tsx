"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
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

import { markClientSubmitted, type FinanceActionResult } from "./actions";

export type FinancePublishRow = {
  id: string;
  position: number;
  postUrl: string;
  publishedAt: string | null;
  creatorHandle: string;
  contractCode: string;
  contractId: string;
  costMinor: number;
  costCurrency: string;
};

export type CampaignQueueGroup = {
  key: string;
  campaignId: string | null;
  campaignName: string;
  clientName: string | null;
  items: FinancePublishRow[];
};

function totalsByCurrency(items: FinancePublishRow[]) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.costCurrency] =
      (accumulator[item.costCurrency] ?? 0) + item.costMinor;
    return accumulator;
  }, {});
}

export function CampaignQueue({ groups }: { groups: CampaignQueueGroup[] }) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nada pendiente de subir</CardTitle>
          <CardDescription>
            Cuando un contenido de un cliente con plataforma pase a Publicado y
            tenga enlace, aparece aquí agrupado por campaña.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <CampaignGroupCard key={group.key} group={group} />
      ))}
    </div>
  );
}

function CampaignGroupCard({ group }: { group: CampaignQueueGroup }) {
  const [state, formAction, pending] = useActionState<
    FinanceActionResult | null,
    FormData
  >(markClientSubmitted, null);
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(group.items.map((item) => [item.id, true]))
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(
        state.count === 1
          ? "1 contenido marcado como subido a la plataforma"
          : `${state.count} contenidos marcados como subidos a la plataforma`
      );
    }
    if (state && !state.ok && state.error) toast.error(state.error);
  }, [state]);

  const selectedItems = group.items.filter((item) => selected[item.id]);
  const links = group.items
    .map((item) => item.postUrl)
    .filter(Boolean)
    .join("\n");
  const selectedTotals = useMemo(
    () => totalsByCurrency(selectedItems),
    [selectedItems]
  );

  function toggleAll(next: boolean) {
    setSelected(Object.fromEntries(group.items.map((item) => [item.id, next])));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{group.campaignName}</CardTitle>
            <CardDescription>
              {group.clientName ? `Cliente: ${group.clientName} · ` : null}
              {group.items.length}{" "}
              {group.items.length === 1 ? "contenido" : "contenidos"}
            </CardDescription>
          </div>
          <CopyButton
            value={links}
            label="Copiar enlaces de la campaña"
            successMessage="Enlaces copiados. Ya puedes pegarlos en la plataforma del cliente."
          />
        </div>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-3">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-8 p-2">
                    <input
                      type="checkbox"
                      checked={selectedItems.length === group.items.length}
                      onChange={(event) => toggleAll(event.target.checked)}
                      aria-label="Seleccionar todos"
                      className="size-4 accent-primary"
                    />
                  </th>
                  <th className="p-2 font-medium">Creator</th>
                  <th className="p-2 font-medium">Contrato</th>
                  <th className="p-2 font-medium">Enlace</th>
                  <th className="p-2 font-medium">Fecha</th>
                  <th className="p-2 font-medium text-right">Coste</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-2 align-middle">
                      <input
                        type="checkbox"
                        name="deliverableIds"
                        value={item.id}
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
                    <td className="max-w-64 p-2">
                      <a
                        href={item.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-xs underline underline-offset-4"
                      >
                        {item.postUrl}
                      </a>
                    </td>
                    <td className="p-2 whitespace-nowrap text-xs text-muted-foreground">
                      {item.publishedAt ? formatDate(item.publishedAt) : "—"}
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
              {Object.entries(selectedTotals).map(([currency, amount]) => (
                <Badge key={currency} variant="outline" className="ml-2">
                  {formatMoney(amount, currency)}
                </Badge>
              ))}
            </p>
            <Button type="submit" disabled={pending || selectedItems.length === 0}>
              {pending
                ? "Marcando…"
                : "Ya están en la plataforma del cliente"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
