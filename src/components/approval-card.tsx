"use client";

import { cn } from "@/lib/utils";

export type ApprovalUiState =
  | "pendiente"
  | "aceptado"
  | "aplicando"
  | "hecho"
  | "descartado"
  | "aviso"
  | "error";

export type ApprovalItem = {
  id: string;
  title: string;
  detail: string;
  state: ApprovalUiState;
  warning?: string;
  handle?: string;
};

const LABEL: Record<ApprovalUiState, string> = {
  pendiente: "Pendiente",
  aceptado: "Aceptado",
  aplicando: "Aplicando",
  hecho: "Hecho",
  descartado: "Descartado",
  aviso: "Aviso",
  error: "Error",
};

export function ApprovalCard({
  title,
  items,
  onAccept,
  onDiscard,
  onAcceptRest,
}: {
  title: string;
  items: ApprovalItem[];
  onAccept?: (id: string) => void;
  onDiscard?: (id: string) => void;
  onAcceptRest?: () => void;
}) {
  const pending = items.filter((item) => item.state === "pendiente" || item.state === "aviso").length;
  const done = items.filter((item) => item.state === "hecho" || item.state === "aceptado").length;

  return (
    <article className="rounded-xl border bg-card p-3">
      <header className="flex items-center justify-between gap-2">
        <p className="text-label-13">{title}</p>
        <span className="text-copy-12 text-fg-subtle">
          {done}/{items.length}
        </span>
      </header>
      <ol className="mt-2 grid gap-2">
        {items.map((item, index) => (
          <li key={item.id} className="grid gap-1 rounded-lg border border-border px-2 py-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-copy-13">
                <span className="text-fg-subtle">{index + 1}</span> {item.title}
              </p>
              <span
                className={cn(
                  "text-label-12",
                  item.state === "hecho" && "text-success",
                  item.state === "descartado" && "text-fg-subtle",
                  item.state === "error" && "text-danger",
                  item.state === "aviso" && "text-warning",
                  item.state === "aplicando" && "text-ai"
                )}
              >
                {LABEL[item.state]}
              </span>
            </div>
            <p className="text-copy-12 text-fg-subtle">{item.detail}</p>
            {item.warning ? <p className="text-copy-12 text-warning">{item.warning}</p> : null}
            {(item.state === "pendiente" || item.state === "aviso") && onAccept && onDiscard ? (
              <div className="flex gap-2">
                <button type="button" className="text-label-12 text-success" onClick={() => onAccept(item.id)}>
                  Aceptar
                </button>
                <button type="button" className="text-label-12 text-fg-subtle" onClick={() => onDiscard(item.id)}>
                  Descartar
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
      {pending > 0 && onAcceptRest ? (
        <button type="button" className="mt-3 text-label-13 text-primary" onClick={onAcceptRest}>
          Aceptar {pending} restantes
        </button>
      ) : null}
    </article>
  );
}
