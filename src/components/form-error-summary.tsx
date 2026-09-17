import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Un formulario largo puede fallar por un campo que está fuera de la pantalla.
// Este resumen evita el peor caso: pulsar enviar y que no pase nada visible.
export function FormErrorSummary({
  error,
  fieldErrors,
  labels,
  id,
}: {
  error?: string;
  fieldErrors?: Record<string, string>;
  labels?: Record<string, string>;
  id?: string;
}) {
  const entries = Object.entries(fieldErrors ?? {});

  if (!error && entries.length === 0) {
    return null;
  }

  return (
    <Alert id={id} variant="destructive" className="scroll-mt-24">
      <TriangleAlertIcon />
      <AlertTitle>
        {error ?? "Revisa estos campos antes de continuar"}
      </AlertTitle>
      {entries.length > 0 ? (
        <AlertDescription>
          <ul className="grid gap-1">
            {entries.map(([field, message]) => (
              <li key={field}>
                <strong>{labels?.[field] ?? field}:</strong> {message}
              </li>
            ))}
          </ul>
        </AlertDescription>
      ) : null}
    </Alert>
  );
}
