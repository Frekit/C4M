"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CREATOR_CSV_EXAMPLE } from "@/lib/domain/creator-import";

import { importCreatorsCsv, type ImportResult } from "../actions";

export function CreatorImportForm() {
  const [state, formAction, pending] = useActionState<
    ImportResult | null,
    FormData
  >(importCreatorsCsv, null);

  useEffect(() => {
    if (state?.ok) {
      toast.success(
        `Creados ${state.created}. Omitidos o avisos: ${state.skipped ?? 0}.`
      );
    }
    if (state && !state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="csv">CSV</Label>
        <Textarea
          id="csv"
          name="csv"
          required
          rows={10}
          defaultValue={CREATOR_CSV_EXAMPLE}
          className="font-mono text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Importando…" : "Importar tanda"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const blob = new Blob([CREATOR_CSV_EXAMPLE], {
              type: "text/csv;charset=utf-8",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "alta-campana.csv";
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
          Creados {state.created}. Avisos {state.skipped}.
        </p>
      ) : null}
    </form>
  );
}
