"use client";

import { CheckIcon, GitPullRequestArrowIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  aplicando: "Aplicando…",
  hecho: "Hecho",
  descartado: "Descartado",
  aviso: "Aviso",
  error: "Error",
};

function Detail({ detail, struck }: { detail: string; struck: boolean }) {
  const parts = detail.split(" → ");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return (
      <p className={cn("text-copy-13", struck && "text-fg-subtle line-through")}>
        <span className="text-fg-subtle line-through">{parts[0]}</span>
        {" → "}
        <span className="text-foreground">{parts[1]}</span>
      </p>
    );
  }
  return (
    <p className={cn("text-copy-13 text-fg-subtle", struck && "line-through")}>{detail}</p>
  );
}

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
  const decided = items.length - pending;

  return (
    <article className="overflow-hidden rounded-xl border border-ai/28 bg-card shadow-(--e2)">
      <header className="flex items-center gap-2 bg-ai-muted/55 px-3 py-2">
        <GitPullRequestArrowIcon className="size-4 text-ai" aria-hidden />
        <p className="min-w-0 flex-1 text-label-13">{title}</p>
        <span className="font-mono text-[11px] text-fg-subtle">
          {decided}/{items.length}
        </span>
      </header>
      <ol className="grid">
        {items.map((item, index) => {
          const open = item.state === "pendiente" || item.state === "aviso";
          const struck = item.state === "descartado";
          return (
            <li
              key={item.id}
              className={cn(
                "grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-2 border-t border-border px-3 py-2",
                item.state === "aceptado" && "bg-success-muted/45",
                item.state === "error" && "border-danger/35"
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-[4px] bg-muted font-mono text-[11px] text-fg-subtle",
                  item.state === "aceptado" && "bg-success-muted text-success"
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-label-12 text-fg-subtle">{item.title}</p>
                <Detail detail={item.detail} struck={struck} />
                {item.warning ? (
                  <p className="mt-1 rounded-md bg-warning-muted px-2 py-1 text-copy-12 text-warning">
                    {item.warning}
                  </p>
                ) : null}
                {!open ? (
                  <p
                    className={cn(
                      "mt-1 text-label-12",
                      item.state === "hecho" && "text-success",
                      item.state === "aceptado" && "text-success",
                      item.state === "descartado" && "text-fg-subtle",
                      item.state === "error" && "text-danger",
                      item.state === "aplicando" && "text-ai"
                    )}
                  >
                    {item.state === "hecho"
                      ? "✓ Hecho"
                      : item.state === "aceptado"
                        ? "✓ Aceptado"
                        : item.state === "descartado"
                          ? "↶ Descartado"
                          : LABEL[item.state]}
                  </p>
                ) : null}
              </div>
              {open && onAccept && onDiscard ? (
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-7"
                    aria-label={`Descartar ${item.title}`}
                    onClick={() => onDiscard(item.id)}
                  >
                    <XIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-sm"
                    className="size-7"
                    aria-label={`Aceptar ${item.title}`}
                    onClick={() => onAccept(item.id)}
                  >
                    <CheckIcon />
                  </Button>
                </div>
              ) : (
                <span className="sr-only">{LABEL[item.state]}</span>
              )}
            </li>
          );
        })}
      </ol>
      {pending > 0 && onAcceptRest ? (
        <footer className="flex items-center justify-between gap-3 border-t border-border bg-muted px-3 py-2">
          <p className="text-copy-12 text-fg-subtle">No se guarda nada hasta que aceptes.</p>
          <Button type="button" size="sm" onClick={onAcceptRest}>
            Aceptar {pending} restantes
          </Button>
        </footer>
      ) : null}
    </article>
  );
}
