"use client";

import { useActionState } from "react";
import { ExternalLinkIcon, SaveIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DELIVERABLE_STATUS,
  DELIVERABLE_STATUS_HINTS,
  DELIVERABLE_STATUS_LABELS,
  DELIVERABLE_STATUS_ORDER,
  type DeliverableStatus,
} from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";

import {
  updateDeliverable,
  type DeliverableActionResult,
} from "@/app/contenidos/actions";

export type DeliverableItem = {
  id: string;
  position: number;
  status: string;
  campaignId: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  paymentDueAt: string | null;
  postUrl: string | null;
  isLate: boolean;
};

const controlClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

function DeliverableRow({
  item,
  campaigns,
  canEdit,
}: {
  item: DeliverableItem;
  campaigns: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    DeliverableActionResult | null,
    FormData
  >(updateDeliverable, null);

  const published = item.status === DELIVERABLE_STATUS.PUBLISHED;

  return (
    <li
      className={`rounded-lg border p-3 ${
        published ? "bg-muted/30" : item.isLate ? "border-destructive/40" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Contenido {item.position}</span>
        <Badge variant={published ? "secondary" : "outline"}>
          {DELIVERABLE_STATUS_LABELS[item.status as DeliverableStatus] ??
            item.status}
        </Badge>
        {item.isLate ? <Badge variant="destructive">Fecha pasada</Badge> : null}
        {item.paymentDueAt ? (
          <span className="text-xs text-muted-foreground">
            Pago previsto {formatDate(item.paymentDueAt)}
          </span>
        ) : null}
        {item.postUrl ? (
          <a
            href={item.postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs underline underline-offset-4"
          >
            Ver post
            <ExternalLinkIcon className="size-3" />
          </a>
        ) : null}
      </div>

      <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-5">
        <input type="hidden" name="deliverableId" value={item.id} />

        <div className="grid gap-1.5">
          <Label htmlFor={`status-${item.id}`} className="text-xs">
            Estado
          </Label>
          <select
            id={`status-${item.id}`}
            name="status"
            defaultValue={item.status}
            disabled={!canEdit}
            className={controlClass}
          >
            {DELIVERABLE_STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {DELIVERABLE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`scheduledFor-${item.id}`} className="text-xs">
            Fecha prevista
          </Label>
          <input
            id={`scheduledFor-${item.id}`}
            type="date"
            name="scheduledFor"
            defaultValue={item.scheduledFor ?? ""}
            disabled={!canEdit}
            className={controlClass}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`publishedAt-${item.id}`} className="text-xs">
            Publicado el
          </Label>
          <input
            id={`publishedAt-${item.id}`}
            type="date"
            name="publishedAt"
            defaultValue={item.publishedAt ?? ""}
            disabled={!canEdit}
            className={controlClass}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`campaignId-${item.id}`} className="text-xs">
            Campaña
          </Label>
          <select
            id={`campaignId-${item.id}`}
            name="campaignId"
            defaultValue={item.campaignId ?? ""}
            disabled={!canEdit}
            className={controlClass}
          >
            <option value="">Sin campaña</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`postUrl-${item.id}`} className="text-xs">
            Enlace
          </Label>
          <input
            id={`postUrl-${item.id}`}
            type="url"
            name="postUrl"
            defaultValue={item.postUrl ?? ""}
            disabled={!canEdit}
            placeholder="https://…"
            className={controlClass}
          />
        </div>

        {canEdit ? (
          <div className="sm:col-span-5">
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              <SaveIcon />
              {pending ? "Guardando…" : "Guardar contenido"}
            </Button>
          </div>
        ) : null}

        {state?.error ? (
          <p className="text-xs text-destructive sm:col-span-5">{state.error}</p>
        ) : null}
        {state?.fieldErrors ? (
          <p className="text-xs text-destructive sm:col-span-5">
            {Object.values(state.fieldErrors).join(" · ")}
          </p>
        ) : null}
      </form>
    </li>
  );
}

export function DeliverableList({
  deliverables,
  campaigns,
  canEdit,
}: {
  deliverables: DeliverableItem[];
  campaigns: { id: string; name: string }[];
  canEdit: boolean;
}) {
  return (
    <div className="grid gap-3">
      <ol className="grid gap-2">
        {deliverables.map((item) => (
          <DeliverableRow
            key={item.id}
            item={item}
            campaigns={campaigns}
            canEdit={canEdit}
          />
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        {DELIVERABLE_STATUS_HINTS.PUBLISHED} La fecha prevista puede estar en el
        futuro: sirve para planificar sin devengar nada.
      </p>
    </div>
  );
}
