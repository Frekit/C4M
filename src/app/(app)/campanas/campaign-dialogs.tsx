"use client";

import { useCallback, useState } from "react";
import { MoreHorizontalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { deleteCampaign } from "./actions";
import { CampaignForm, type CampaignClientOption } from "./campaign-form";

export function NewCampaignDialog({
  clients,
}: {
  clients: CampaignClientOption[];
}) {
  const [open, setOpen] = useState(false);
  const handleCreated = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Nueva campaña</Button>} />
      <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva campaña</DialogTitle>
          <DialogDescription>
            El nombre es lo único obligatorio; las fechas ayudan a ordenar el
            calendario.
          </DialogDescription>
        </DialogHeader>
        <CampaignForm clients={clients} onCreated={handleCreated} />
      </DialogContent>
    </Dialog>
  );
}

export function DeleteCampaignMenu({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Más acciones de ${campaignName}`}
            />
          }
        >
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onClick={() => setOpen(true)}>
            Borrar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar {campaignName}</DialogTitle>
            <DialogDescription>
              Se elimina la campaña vacía. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <form action={deleteCampaign}>
              <input type="hidden" name="campaignId" value={campaignId} />
              <Button type="submit" variant="destructive">
                Borrar
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
