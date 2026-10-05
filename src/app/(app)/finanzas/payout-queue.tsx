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
import { formatDate, relativeDueLabel } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { PayoutGroup, PayoutItem } from "@/lib/domain/finance-queues";
import { buildZexelLote } from "@/lib/domain/zexel-batch";

import { markPaid, type FinanceActionResult } from "./actions";

export type { PayoutGroup, PayoutItem };

function totalsByCurrency(items: PayoutItem[]) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.costCurrency] =
      (accumulator[item.costCurrency] ?? 0) + item.costMinor;
    return accumulator;
  }, {});
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function loteFilename() {
  const today = new Date().toISOString().slice(0, 10);
  return `zexel-lote-${today}.csv`;
}

export function PayoutQueue({ groups }: { groups: PayoutGroup[] }) {
  const allIds = groups.flatMap((group) => group.items.map((item) => item.id));
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(allIds.map((id) => [id, true]))
  );
  const [state, formAction, pending] = useActionState<
    FinanceActionResult | null,
    FormData
  >(markPaid, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(
        state.count === 1
          ? "1 contenido marcado como pagado en el lote"
          : `${state.count} contenidos marcados como pagados en el lote`
      );
    }
    if (state && !state.ok && state.error) toast.error(state.error);
  }, [state]);

  const selectedIds = useMemo(
    () =>
      groups.flatMap((group) =>
        group.items.filter((item) => selected[item.id]).map((item) => item.id)
      ),
    [groups, selected]
  );
  const lote = useMemo(
    () => buildZexelLote(groups, selectedIds),
    [groups, selectedIds]
  );

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Todavía no hay nada que pagar</CardTitle>
          <CardDescription>
            Cuando haya piezas en plataforma o un pack cerrado, se arma aquí
            el lote de Zexel (email, importe y moneda). Al marcar el lote como
            pagado sale de la cola.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  function toggleGroup(group: PayoutGroup, next: boolean) {
    setSelected((current) => ({
      ...current,
      ...Object.fromEntries(group.items.map((item) => [item.id, next])),
    }));
  }

  return (
    <form action={formAction} className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Lote Zexel</CardTitle>
              <CardDescription>
                Una fila por perfil y moneda: email;importe;moneda. Súbelo en
                Zexel Pay → Nuevo lote con CSV y, cuando salga, marca el lote
                como pagado.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {lote.ready.map((row) => (
                <Badge key={row.key} variant="secondary">
                  {formatMoney(row.amountMinor, row.currency)}
                </Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {lote.missingEmail.length > 0 ? (
            <p className="text-sm text-destructive">
              Falta el email de cobro en{" "}
              {lote.missingEmail
                .map((row) => `@${row.creatorHandle}`)
                .join(" · ")}
              . Sin email no entran en el CSV de Zexel.
            </p>
          ) : null}

          {lote.ready.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Selecciona contenidos con email de cobro para armar el CSV.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 font-medium">Email Zexel</th>
                    <th className="p-2 font-medium">Perfil</th>
                    <th className="p-2 font-medium text-right">Importe</th>
                    <th className="p-2 font-medium">Moneda</th>
                  </tr>
                </thead>
                <tbody>
                  {lote.ready.map((row) => (
                    <tr key={row.key} className="border-t">
                      <td className="p-2 font-mono text-xs">{row.email}</td>
                      <td className="p-2">
                        @{row.creatorHandle}
                        {row.payeeName ? (
                          <span className="block text-xs text-muted-foreground">
                            {row.payeeName}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-2 text-right">
                        {formatMoney(row.amountMinor, row.currency)}
                      </td>
                      <td className="p-2">{row.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <CopyButton
                value={lote.csv}
                label="Copiar CSV"
                successMessage="CSV de Zexel copiado"
                size="sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={lote.ready.length === 0}
                onClick={() => downloadCsv(lote.csv, loteFilename())}
              >
                Descargar CSV
              </Button>
            </div>
            <Button
              type="submit"
              disabled={pending || selectedIds.length === 0}
            >
              {pending ? "Marcando…" : "Lote ya pagado en Zexel"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {groups.map((group) => {
        const selectedItems = group.items.filter((item) => selected[item.id]);
        const totals = totalsByCurrency(group.items);

        return (
          <Card key={group.creatorId}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>@{group.creatorHandle}</CardTitle>
                  <CardDescription>
                    {group.zexelEmail ??
                      "Sin email de cobro: falta la firma o el email."}
                    {group.payeeName ? ` · ${group.payeeName}` : ""}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(totals).map(([currency, amount]) => (
                    <Badge key={currency} variant="outline">
                      {formatMoney(amount, currency)}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {group.zexelEmail ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <span className="text-muted-foreground">Zexel:</span>
                  <span className="font-mono">{group.zexelEmail}</span>
                  <CopyButton
                    value={group.zexelEmail}
                    label="Copiar email"
                    size="xs"
                    successMessage="Email copiado"
                  />
                </div>
              ) : (
                <p className="text-sm text-destructive">
                  Este perfil no tiene email de cobro. Zexel no puede incluirlo
                  en el lote hasta que firme con un email.
                </p>
              )}

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
                          aria-label={`Incluir ${item.contractCode} contenido ${item.position} en el lote`}
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

              <p className="text-sm text-muted-foreground">
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() =>
                    toggleGroup(
                      group,
                      selectedItems.length !== group.items.length
                    )
                  }
                >
                  {selectedItems.length === group.items.length
                    ? "Quitar del lote"
                    : "Meter todos en el lote"}
                </button>
                <span className="ml-2">
                  {selectedItems.length} de {group.items.length}
                </span>
              </p>
            </CardContent>
          </Card>
        );
      })}
    </form>
  );
}
