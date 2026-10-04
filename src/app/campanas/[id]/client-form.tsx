"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  setCampaignClient,
  type CampaignActionResult,
} from "@/app/campanas/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 sm:w-64";

export function CampaignClientForm({
  campaignId,
  clientId,
  clients,
}: {
  campaignId: string;
  clientId: string;
  clients: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<
    CampaignActionResult | null,
    FormData
  >(setCampaignClient, null);
  const [selected, setSelected] = useState(clientId);

  useEffect(() => {
    if (state?.ok) toast.success("Cliente de la campaña guardado.");
    else if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="grid gap-1">
        <Label htmlFor="campaignClientId" className="text-xs">
          Cliente de la campaña
        </Label>
        <select
          id="campaignClientId"
          name="clientId"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className={selectClass}
        >
          <option value="">Sin cliente</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending || !selected}>
        {pending ? "Guardando…" : "Asignar cliente"}
      </Button>
    </form>
  );
}
