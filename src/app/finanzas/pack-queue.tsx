import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export type PackQueueItem = {
  id: string;
  position: number;
  status: string;
  postUrl: string | null;
  publishedAt: string | null;
  costMinor: number;
  costCurrency: string;
};

export type PackQueueGroup = {
  key: string;
  campaignId: string;
  campaignName: string;
  clientName: string;
  creatorId: string;
  creatorHandle: string;
  published: number;
  total: number;
  isComplete: boolean;
  paymentDueAt: string | null;
  items: PackQueueItem[];
};

function totalsByCurrency(items: PackQueueItem[]) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item.costCurrency] =
      (accumulator[item.costCurrency] ?? 0) + item.costMinor;
    return accumulator;
  }, {});
}

export function PackQueue({ groups }: { groups: PackQueueGroup[] }) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ningún pack en curso</CardTitle>
          <CardDescription>
            Los clientes que se liquidan al cerrar el pack (Many Chat y
            similares) aparecen aquí por campaña y perfil.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const ready = groups.filter((group) => group.isComplete);
  const open = groups.filter((group) => !group.isComplete);

  return (
    <div className="grid gap-4">
      {ready.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {ready.length} {ready.length === 1 ? "pack listo" : "packs listos"}{" "}
          para cobrar al cliente y pagar al perfil.
        </p>
      ) : null}

      {[...ready, ...open].map((group) => {
        const totals = totalsByCurrency(group.items);

        return (
          <Card key={group.key}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>
                    {group.clientName} · @{group.creatorHandle}
                  </CardTitle>
                  <CardDescription>
                    {group.campaignName} · {group.published}/{group.total}{" "}
                    publicados
                    {group.isComplete && group.paymentDueAt
                      ? ` · pago ${formatDate(group.paymentDueAt)}`
                      : ""}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.isComplete ? (
                    <Badge variant="secondary">Listo para cobrar</Badge>
                  ) : (
                    <Badge variant="outline">Pack {group.published}/{group.total}</Badge>
                  )}
                  {Object.entries(totals).map(([currency, amount]) => (
                    <Badge key={currency} variant="outline">
                      {formatMoney(amount, currency)}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Progress
                value={group.total > 0 ? (group.published / group.total) * 100 : 0}
                className="h-1.5"
              />
              <ul className="grid gap-1 text-sm">
                {group.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      nº {item.position}
                      {item.publishedAt
                        ? ` · ${formatDate(item.publishedAt)}`
                        : " · pendiente"}
                    </span>
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
                  </li>
                ))}
              </ul>
              {!group.isComplete ? (
                <p className="text-xs text-muted-foreground">
                  Hasta que estén todos publicados no se factura al cliente ni
                  se paga a @{group.creatorHandle}.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Pack cerrado. El lote entra en Pagar perfiles con la fecha de
                  la última publicación.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
