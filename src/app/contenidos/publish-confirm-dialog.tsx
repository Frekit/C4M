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

export function PublishConfirmDialog({
  open,
  costMinor,
  costCurrency,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  costMinor: number;
  costCurrency: string;
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
            Esto no es solo un cambio de estado: se devenga{" "}
            <strong className="text-foreground">
              {formatMoney(costMinor, costCurrency)}
            </strong>{" "}
            y se calcula la fecha de pago a partir de la publicación. Si te
            has equivocado de contenido, cancela.
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
