"use client";

import { SparklesIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Cromo del panel. El contenido de ejemplo llega en el bloque del asistente. */
export function AiPanel({ onClose }: { onClose: () => void }) {
  return (
    <section
      aria-label="Asistente"
      className="flex h-full min-h-0 flex-col bg-card text-card-foreground max-[760px]:bg-background"
    >
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b px-3">
        <SparklesIcon className="size-4 text-ai" />
        <p className="text-label-13">Asistente</p>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={onClose}
          aria-label="Cerrar asistente"
        >
          <XIcon />
        </Button>
      </header>
      <div className="flex flex-1 flex-col justify-end gap-3 p-4">
        <p className="text-copy-14 text-muted-foreground">
          Pregúntame por esta pantalla o pídeme cambios. Te enseñaré cada cambio antes de hacerlo.
        </p>
        <label className="sr-only" htmlFor="ai-composer">
          Mensaje para el asistente
        </label>
        <textarea
          id="ai-composer"
          rows={2}
          placeholder="Pide algo…"
          className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-copy-14 outline-none focus-visible:border-ring"
        />
      </div>
    </section>
  );
}
