"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { SparklesIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { ApprovalCard, type ApprovalItem } from "@/components/approval-card";
import { useShell } from "@/components/shell-context";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/hooks/use-hotkeys";

const DEMO = process.env.NEXT_PUBLIC_AI_PANEL === "demo";

const DEMO_ITEMS: ApprovalItem[] = [
  {
    id: "1",
    handle: "techconjavi",
    title: "Cambiar estado · @techconjavi",
    detail: "Propuesto → Aprobado",
    state: "pendiente",
  },
  {
    id: "2",
    handle: "sarabakes",
    title: "Cambiar estado · @sarabakes",
    detail: "Propuesto → Aprobado",
    state: "pendiente",
  },
  {
    id: "3",
    handle: "sarabakes",
    title: "Crear contrato · @sarabakes",
    detail: "Borrador, sin enviar a firma",
    state: "pendiente",
  },
  {
    id: "4",
    handle: "techconjavi",
    title: "Crear contrato · @techconjavi",
    detail: "No se puede enviar a firma",
    state: "aviso",
    warning: "No tiene email de contacto. El contrato se crearía como borrador.",
  },
];

function routeChip(pathname: string) {
  if (pathname.startsWith("/campanas/")) return "Campaña · Planilla";
  if (pathname.startsWith("/contratos/")) return "Contrato";
  if (pathname.startsWith("/contenidos")) return "Contenidos";
  if (pathname === "/") return "Centro de acciones";
  return "Esta pantalla";
}

export function AiPanel({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const shell = useShell();
  const [draft, setDraft] = useState(shell.aiSeed ?? "");
  const [items, setItems] = useState<ApprovalItem[]>(DEMO ? DEMO_ITEMS : []);
  const [note, setNote] = useState<string | null>(null);

  function patch(id: string, state: ApprovalItem["state"]) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, state } : item)));
  }

  function finish(ids: string[]) {
    const handles = items.filter((item) => ids.includes(item.id) && item.handle).map((item) => item.handle as string);
    ids.forEach((id) => patch(id, "aplicando"));
    window.setTimeout(() => {
      ids.forEach((id) => patch(id, "hecho"));
      if (handles.length > 0) shell.markAiFlash(handles);
      toast(`${ids.length} cambios aplicados por el asistente`, {
        description: "Simulación local. No se ha escrito nada en la base de datos.",
      });
    }, 400);
  }

  useHotkeys({
    y: () => {
      const item = items.find((entry) => entry.state === "pendiente" || entry.state === "aviso");
      if (!item) return;
      finish([item.id]);
    },
    n: () => {
      const item = items.find((entry) => entry.state === "pendiente" || entry.state === "aviso");
      if (!item) return;
      patch(item.id, "descartado");
    },
  });

  return (
    <section aria-label="Asistente" className="flex h-full min-h-0 flex-col bg-card">
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b px-3">
        <SparklesIcon className="size-4 text-ai" />
        <p className="text-label-13">Asistente</p>
        <span className="inline-flex max-w-[46%] items-center truncate rounded-full border border-border bg-card px-2 py-0.5 text-label-12 text-muted-foreground">
          {routeChip(pathname)}
        </span>
        <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onClose} aria-label="Cerrar asistente">
          <XIcon />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {DEMO ? (
          <>
            <p className="ml-auto max-w-[86%] rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-copy-14">
              Higgsfield ha aprobado a @sarabakes y @techconjavi.
            </p>
            <p className="rounded-lg border border-border bg-muted px-2 py-1.5 text-copy-12 text-success">
              ✓ Ha leído la Planilla de Navidad 2026 · 8 filas
            </p>
            <p className="text-copy-14">
              Propongo 4 cambios. No se guarda nada hasta que los aceptes. Esto es una simulación: no hay modelo ni escritura.
            </p>
            <ApprovalCard
              title="Navidad 2026 // 4 cambios"
              items={items}
              onAccept={(id) => finish([id])}
              onDiscard={(id) => patch(id, "descartado")}
              onAcceptRest={() =>
                finish(items.filter((item) => item.state === "pendiente" || item.state === "aviso").map((item) => item.id))
              }
            />
          </>
        ) : (
          <p className="text-copy-14 text-muted-foreground">
            Pregúntame por esta pantalla o pídeme cambios. Te enseñaré cada cambio antes de hacerlo.
          </p>
        )}
        {note ? <p className="text-copy-13 text-muted-foreground">{note}</p> : null}
        <div className="mt-auto flex flex-wrap gap-2">
          {[
            "Añade el email de @techconjavi",
            "¿Quién va con retraso?",
            "Resume la planilla",
          ].map((chip) => (
            <button
              key={chip}
              type="button"
              className="h-7 rounded-full border border-border bg-card px-2.5 text-label-12 text-muted-foreground hover:border-ai/40 hover:bg-ai-muted hover:text-ai"
              onClick={() => {
                setDraft("");
                setNote(
                  DEMO
                    ? `Modo demo: «${chip}» no se envía a un modelo. La tarjeta de arriba sigue siendo el ejemplo.`
                    : "El asistente todavía no está conectado. NEXT_PUBLIC_AI_PANEL=demo muestra el ejemplo."
                );
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
      <form
        className="border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setNote(
            DEMO
              ? "Modo demo: no hay modelo conectado. Los cambios de la tarjeta de arriba solo viven en esta pantalla."
              : "El asistente todavía no está conectado. NEXT_PUBLIC_AI_PANEL=demo muestra el ejemplo."
          );
          setDraft("");
        }}
      >
        <label className="sr-only" htmlFor="ai-composer">
          Mensaje para el asistente
        </label>
        <textarea
          id="ai-composer"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={pathname.startsWith("/campanas/") ? "Pide algo sobre esta campaña…" : "Pide algo…"}
          className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-copy-14 outline-none focus-visible:border-ring"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-copy-12 text-fg-subtle">El asistente propone; tú decides.</p>
          <Button type="submit" size="sm">
            Enviar
          </Button>
        </div>
      </form>
    </section>
  );
}
