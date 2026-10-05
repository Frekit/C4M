"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  updateCreatorMedianViews,
  type RosterWriteResult,
} from "@/app/creators/roster-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MedianViewsForm({
  creatorId,
  amount,
}: {
  creatorId: string;
  amount: string;
}) {
  const [state, formAction, pending] = useActionState<
    RosterWriteResult | null,
    FormData
  >(updateCreatorMedianViews, null);

  useEffect(() => {
    if (state?.ok) toast.success("Mediana de views actualizada.");
    else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="creatorId" value={creatorId} />
      <div className="grid gap-1">
        <Label htmlFor="igMedianViews" className="text-xs">
          Mediana de views
        </Label>
        <Input
          id="igMedianViews"
          name="igMedianViews"
          inputMode="numeric"
          required
          defaultValue={amount}
          placeholder="12.500"
          className="w-36"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando…" : "Actualizar"}
      </Button>
    </form>
  );
}
