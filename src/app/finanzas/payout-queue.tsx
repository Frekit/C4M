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
import {
  PAYOUT_METHOD,
  PAYOUT_METHOD_LABELS,
  type PayoutMethod,
} from "@/lib/domain/enums";
import { formatDate, relativeDueLabel } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { PayoutGroup, PayoutItem } from "@/lib/domain/finance-queues";

import { markPaid, type FinanceActionResult } from "./actions";

export type { PayoutGroup, PayoutItem };

function totalsByCurrency(items: PayoutItem[]) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.costCurrency] =
      (accumulator[item.costCurrency] ?? 0) + item.costMinor;
    return accumulator;
  }, {});
}

export function PayoutQueue({ groups }: { groups: PayoutGroup[] }) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Todavía no hay nada que pagar</CardTitle>
          <CardDescription>
            Cuando Finanzas marque como submitted los de plataforma, o se
            cierre el pack de un cliente tradicional, aparecen aquí agrupados
            por perfil, con cuenta e importe. Al marcarlos pagados salen de
            esta cola.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <PayoutGroupCard key={group.creatorId} group={group} />
      ))}
    </div>
  );
}

function PayoutGroupCard({ group }: { group: PayoutGroup }) {
  const [state, formAction, pending] = useActionState<
    FinanceActionResult | null,
    FormData
  >(markPaid, null);
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(group.items.map((item) => [item.id, true]))
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(
        state.count === 1
          ? "1 contenido marcado como pagado"
          : `${state.count} contenidos marcados como pagados`
      );
    }
    if (state && !state.ok && state.error) toast.error(state.error);
  }, [state]);

  const selectedItems = group.items.filter((item) => selected[item.id]);
  const selectedTotals = useMemo(
    () => totalsByCurrency(selectedItems),
    [selectedItems]
  );
  const totals = totalsByCurrency(group.items);
  const methodLabel = group.payoutMethod
    ? PAYOUT_METHOD_LABELS[group.payoutMethod as PayoutMethod]
    : null;

  function toggleAll(next: boolean) {
    setSelected(Object.fromEntries(group.items.map((item) => [item.id, next])));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>@{group.creatorHandle}</CardTitle>
            <CardDescription>
              {group.payeeName ?? "Sin ficha de pago: falta la firma."}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(totals).map(([currency, amount]) => (
              <Badge key={currency} variant="secondary">
                {formatMoney(amount, currency)}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {group.account ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
            <span className="text-muted-foreground">
              {group.payoutMethod === PAYOUT_METHOD.WISE
                ? "Wise"
                : methodLabel ?? "Cuenta"}
              :
            </span>
            <span className="font-mono">{group.account}</span>
            <CopyButton
              value={group.account}
              label="Copiar cuenta"
              size="xs"
              successMessage="Cuenta copiada"
            />
            {group.payoutCurrency ? (
              <Badge variant="outline">{group.payoutCurrency}</Badge>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-destructive">
            Este perfil no tiene datos de cobro. No se le puede pagar
            hasta que firme y deje IBAN o Wise.
          </p>
        )}

        <form action={formAction} className="grid gap-3">
          <ul className="grid gap-2">
            {group.items.map((item) => {
              const overdue =
                item.paymentDueAt !== null &&
                new Date(item.paymentDueAt) < new Date();

              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <label className="flex min-w-0 items-start gap-3">
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
                      aria-label={`Seleccionar ${item.contractCode} contenido ${item.position}`}
                      className="mt-1 size-4 accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {item.contractCode} · contenido {item.position}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        Pago {formatDate(item.paymentDueAt)} ·{" "}
                        {relativeDueLabel(item.paymentDueAt)}
                      </span>
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                    {item.postUrl ? (
                      <a
                        href={item.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline underline-offset-4"
                      >
                        Ver post
                      </a>
                    ) : null}
                    <span className="text-sm font-medium">
                      {formatMoney(item.costMinor, item.costCurrency)}
                    </span>
                    {overdue ? (
                      <Badge variant="destructive">Vencido</Badge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <button
                type="button"
                className="mr-2 underline underline-offset-4"
                onClick={() =>
                  toggleAll(selectedItems.length !== group.items.length)
                }
              >
                {selectedItems.length === group.items.length
                  ? "Quitar todos"
                  : "Seleccionar todos"}
              </button>
              {selectedItems.length} seleccionados
              {Object.entries(selectedTotals).map(([currency, amount]) => (
                <Badge key={currency} variant="outline" className="ml-2">
                  {formatMoney(amount, currency)}
                </Badge>
              ))}
            </p>
            <Button type="submit" disabled={pending || selectedItems.length === 0}>
              {pending ? "Marcando…" : "Ya está pagado"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
