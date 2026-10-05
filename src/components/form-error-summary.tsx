"use client";

import { useEffect, useRef } from "react";
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
  const summaryRef = useRef<HTMLDivElement>(null);
  const idKey = entries.map(([field]) => field).join("\u0000");
  const signature = `${error ?? ""}|${entries.map(([field, message]) => `${field}:${message}`).join("|")}`;

  useEffect(() => {
    const ids = idKey ? idKey.split("\u0000") : [];
    if (!error && ids.length === 0) return;
    const fields = ids
      .map((field) => document.getElementById(field))
      .filter((field): field is HTMLElement => field instanceof HTMLElement)
      .sort((a, b) => {
        if (a === b) return 0;
        const position = a.compareDocumentPosition(b);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      });
    const target = fields[0] ?? summaryRef.current;
    target?.focus();
    target?.scrollIntoView({ block: "center" });
  }, [error, idKey, signature]);

  if (!error && entries.length === 0) {
    return null;
  }

  return (
    <Alert
      ref={summaryRef}
      id={id}
      tabIndex={-1}
      variant="destructive"
      className="scroll-mt-24"
    >
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
