import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CreatorPaymentRow } from "@/lib/domain/creator-payments";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export function CreatorPaymentHistory({ rows }: { rows: CreatorPaymentRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de pagos</CardTitle>
        <CardDescription>
          Cada fila es un contenido marcado como pagado en Finanzas (lote
          Zexel). Queda quién lo marcó, cuándo y el importe de ese momento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay pagos registrados en este perfil.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuándo</TableHead>
                <TableHead>Contenido</TableHead>
                <TableHead>Campaña</TableHead>
                <TableHead>Importe</TableHead>
                <TableHead>Quién</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateTime(row.paidAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Link
                      href={`/contratos/${row.contractId}`}
                      className="font-medium hover:underline"
                    >
                      {row.contractCode} · nº {row.position}
                    </Link>
                    {row.postUrl ? (
                      <a
                        href={row.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4"
                      >
                        Ver post
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">
                    <p>{row.campaignName ?? "Sin campaña"}</p>
                    {row.clientName ? (
                      <p className="text-xs text-muted-foreground">
                        {row.clientName}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm font-medium">
                    {formatMoney(row.amountMinor, row.currency)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.paidByEmail ?? "Sin registrar (pago anterior)"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
