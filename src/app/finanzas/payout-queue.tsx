import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
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
            por perfil, con cuenta e importe.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => {
        const totals = totalsByCurrency(group.items);
        const methodLabel = group.payoutMethod
          ? PAYOUT_METHOD_LABELS[group.payoutMethod as PayoutMethod]
          : null;

        return (
          <Card key={group.creatorId}>
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
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {item.contractCode} · contenido {item.position}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Pago {formatDate(item.paymentDueAt)} ·{" "}
                          {relativeDueLabel(item.paymentDueAt)}
                        </p>
                      </div>
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
