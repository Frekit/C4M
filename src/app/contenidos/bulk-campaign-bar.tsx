"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { assignCampaign, type DeliverableActionResult } from "./actions";

export function BulkCampaignBar({
  campaigns,
}: {
  campaigns: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<
    DeliverableActionResult | null,
    FormData
  >(assignCampaign, null);

  useEffect(() => {
    if (state?.ok) toast.success("Contenidos agrupados en la campaña");
    if (state && !state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      id="bulk-campaign"
      action={formAction}
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3"
    >
      <span className="text-sm text-muted-foreground">
        Marca contenidos en la tabla y agrúpalos:
      </span>

      <select
        name="campaignId"
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
        aria-label="Campaña a asignar"
      >
        <option value="">Quitar campaña</option>
        {campaigns.map((campaign) => (
          <option key={campaign.id} value={campaign.id}>
            {campaign.name}
          </option>
        ))}
      </select>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Asignando…" : "Asignar a los seleccionados"}
      </Button>
    </form>
  );
}
