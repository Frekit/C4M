import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { RecentPaidItem } from "@/lib/domain/finance-queues";

export function RecentPaid({ items }: { items: RecentPaidItem[] }) {
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagados recientemente</CardTitle>
        <CardDescription>
          Ya salieron de la cola. Los últimos {items.length} marcados como
          pagados.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  @{item.creatorHandle} · {item.contractCode} · contenido{" "}
                  {item.position}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pagado {formatDateTime(item.paidAt)}
                </p>
              </div>
              <span className="font-medium">
                {formatMoney(item.costMinor, item.costCurrency)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
