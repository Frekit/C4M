"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ROWS: { keys: string; action: string; where: string }[] = [
  { keys: "⌘K", action: "Paleta de comandos", where: "Global" },
  { keys: "⌘J", action: "Abrir o cerrar el asistente", where: "Global" },
  { keys: "/", action: "Enfocar el filtro de la tabla", where: "Tablas" },
  { keys: "G luego A", action: "Ir al Centro de acciones", where: "Global" },
  { keys: "G luego C", action: "Ir a Campañas", where: "Global" },
  { keys: "G luego O", action: "Ir a Contenidos", where: "Global" },
  { keys: "G luego T", action: "Ir a Contratos", where: "Global" },
  { keys: "G luego F", action: "Ir a Finanzas", where: "Global" },
  { keys: "J / K", action: "Siguiente / anterior", where: "Listas" },
  { keys: "Intro", action: "Abrir o ejecutar la acción principal", where: "Listas" },
  { keys: "X", action: "Seleccionar la fila", where: "Tablas" },
  { keys: "⇧ + clic", action: "Seleccionar un rango", where: "Tablas" },
  { keys: "A / B / C", action: "Elegir opción de la tarjeta", where: "Centro de acciones" },
  { keys: "E", action: "Marcar la tarjeta como resuelta", where: "Centro de acciones" },
  { keys: "⌘↵", action: "CTA primario de la vista", where: "Contrato, Sheet" },
  { keys: "Y / N", action: "Aceptar / descartar el cambio", where: "Asistente" },
  { keys: "Esc", action: "Cerrar el overlay superior", where: "Global" },
  { keys: "?", action: "Ver estos atajos", where: "Global" },
];

export function HotkeysDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Atajos</DialogTitle>
          <DialogDescription>
            En Windows y Linux, ⌘ es Ctrl. Las teclas sueltas no actúan si estás escribiendo.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-[60vh] overflow-auto">
          {ROWS.map((row) => (
            <li
              key={row.keys + row.action}
              className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0"
            >
              <span className="text-copy-13">
                {row.action}
                <span className="mt-0.5 block text-copy-12 text-fg-subtle">{row.where}</span>
              </span>
              <kbd className="shrink-0 rounded-[4px] border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
