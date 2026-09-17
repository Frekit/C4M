"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";
import type { PackProgress } from "@/lib/domain/settlement";

export function PublishConfirmDialog({
  open,
  costMinor,
  costCurrency,
  pack,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  costMinor: number;
  costCurrency: string;
  pack?: PackProgress | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Confirmas que ya está publicado?</DialogTitle>
          <DialogDescription>
            {pack
              ? pack.published + 1 >= pack.total
                ? `Esto registra que el post ya está en redes. Con el pack cerrado se liquida el lote (${formatMoney(costMinor, costCurrency)} por pieza) a partir de esta última publicación.`
                : `Esto registra que el post ya está en redes. El pack va ${pack.published + 1}/${pack.total}: hasta completarlo no se cobra al cliente ni se paga a este perfil.`
              : `Esto registra que el post ya está en redes, con el enlace que has puesto, y calcula la fecha de pago (${formatMoney(costMinor, costCurrency)}). Pagar al perfil no empieza aquí: si el cliente tiene plataforma, Finanzas lo marca como submitted al subirlo.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm}>
            Sí, está publicado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
