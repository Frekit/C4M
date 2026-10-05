import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CampaignResults } from "@/lib/domain/campaign-results";
import { formatMoney } from "@/lib/money";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background px-3 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-heading text-xl font-medium tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}

export function CampaignResultsTable({ results }: { results: CampaignResults }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resultados</CardTitle>
        <CardDescription>
          Lo publicado en esta campaña. La venta es por pieza. El coste es lo
          que se le paga al perfil, no se lo enseñamos al cliente.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Tile label="Publicados" value={String(results.published)} />
          <Tile label="Sin URL" value={String(results.missingUrl)} />
          <Tile label="Venta" value={formatMoney(results.saleCents, "USD")} />
          <Tile label="Coste" value={results.costLabel} />
        </div>
        {results.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay piezas. Aparecen cuando una línea se activa.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  {["Perfil", "Formato", "Venta", "Coste", "Estado", "URL"].map(
                    (label) => (
                      <th key={label} className="px-3 py-2 font-medium">
                        {label}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {results.rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2 font-medium">@{row.handle}</td>
                    <td className="px-3 py-2">{row.formatLabel}</td>
                    <td className="px-3 py-2 tabular-nums">{row.saleLabel}</td>
                    <td className="px-3 py-2 tabular-nums">{row.costLabel}</td>
                    <td className="px-3 py-2">{row.statusLabel}</td>
                    <td className="px-3 py-2">
                      {row.postUrl ? (
                        <a
                          href={row.postUrl}
                          className="underline underline-offset-4"
                        >
                          Abrir
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Sin URL</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
