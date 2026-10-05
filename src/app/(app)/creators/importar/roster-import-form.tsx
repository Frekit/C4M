"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { importRosterFile, type RosterWriteResult } from "@/app/(app)/creators/roster-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROSTER_CSV_EXAMPLE } from "@/lib/domain/roster-import";

export function RosterImportForm() {
  const [state, formAction, pending] = useActionState<
    RosterWriteResult | null,
    FormData
  >(importRosterFile, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(
        `Nuevos ${state.created ?? 0}. Actualizados ${state.updated ?? 0}.`
      );
    }
    if (state && !state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="file">Excel o CSV</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,.tsv,.txt,.xlsx,.xls"
          className="text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Columnas flexibles: Instagram (obligatoria), país y tipo. Excel
          español con punto y coma también vale.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="csv">O pega la tabla</Label>
        <Textarea
          id="csv"
          name="csv"
          rows={8}
          defaultValue={ROSTER_CSV_EXAMPLE}
          className="font-mono text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Importando…" : "Meter en el roster"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const blob = new Blob([ROSTER_CSV_EXAMPLE], {
              type: "text/csv;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "roster-instagram.csv";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Descargar plantilla
        </Button>
      </div>
      {state?.issues && state.issues.length > 0 ? (
        <ul className="grid gap-1 text-sm text-destructive">
          {state.issues.map((issue) => (
            <li key={`${issue.line}-${issue.message}`}>
              Línea {issue.line}: {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-muted-foreground">
          Nuevos {state.created}. Actualizados {state.updated}. Avisos{" "}
          {state.skipped}.
        </p>
      ) : null}
    </form>
  );
}
