"use client";

import { ExternalLinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  DELIVERABLE_STATUS,
  DELIVERABLE_STATUS_LABELS,
  OPS_DELIVERABLE_STATUSES,
  type DeliverableStatus,
} from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";
import type { PackProgress } from "@/lib/domain/settlement";

import { PublishConfirmDialog } from "@/app/contenidos/publish-confirm-dialog";
import { useDeliverableAutosave } from "@/app/contenidos/use-deliverable-autosave";

export type DeliverableItem = {
  id: string;
  position: number;
  status: string;
  campaignId: string | null;
  contentDate: string | null;
  paymentDueAt: string | null;
  postUrl: string | null;
  isLate: boolean;
  costMinor: number;
  costCurrency: string;
  contractSigned: boolean;
  pack: PackProgress | null;
};

const controlClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

function editorKey(item: DeliverableItem) {
  return [
    item.id,
    item.status,
    item.contentDate ?? "",
    item.campaignId ?? "",
    item.postUrl ?? "",
  ].join(":");
}

function DeliverableRow({
  item,
  campaigns,
  canEdit,
}: {
  item: DeliverableItem;
  campaigns: { id: string; name: string; clientName?: string | null }[];
  canEdit: boolean;
}) {
  return (
    <DeliverableRowFields
      key={editorKey(item)}
      item={item}
      campaigns={campaigns}
      canEdit={canEdit}
    />
  );
}

function DeliverableRowFields({
  item,
  campaigns,
  canEdit,
}: {
  item: DeliverableItem;
  campaigns: { id: string; name: string; clientName?: string | null }[];
  canEdit: boolean;
}) {
  const {
    formRef,
    formAction,
    pending,
    state,
    clientError,
    publishOpen,
    onFieldChange,
    onUrlBlur,
    confirmPublish,
    cancelPublish,
  } = useDeliverableAutosave(item, canEdit);

  const isLive =
    item.status === DELIVERABLE_STATUS.PUBLISHED ||
    item.status === DELIVERABLE_STATUS.SUBMITTED;

  const errorText =
    clientError ??
    state?.error ??
    (state?.fieldErrors
      ? Object.values(state.fieldErrors).join(" · ")
      : null);

  return (
    <li
      className={`rounded-lg border p-3 ${
        isLive ? "bg-muted/30" : item.isLate ? "border-destructive/40" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Contenido {item.position}</span>
        <Badge variant={isLive ? "secondary" : "outline"}>
          {DELIVERABLE_STATUS_LABELS[item.status as DeliverableStatus] ??
            item.status}
        </Badge>
        {item.isLate ? <Badge variant="destructive">Fecha pasada</Badge> : null}
        {item.pack ? (
          <Badge variant={item.pack.isComplete ? "secondary" : "outline"}>
            Pack {item.pack.published}/{item.pack.total}
          </Badge>
        ) : null}
        {item.paymentDueAt ? (
          <span className="text-xs text-muted-foreground">
            Pago previsto {formatDate(item.paymentDueAt)}
          </span>
        ) : item.pack && !item.pack.isComplete ? (
          <span className="text-xs text-muted-foreground">
            Se paga al cerrar el pack
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
        {pending ? (
          <span className="text-xs text-muted-foreground">Guardando…</span>
        ) : null}
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="mt-3 grid gap-3 sm:grid-cols-4"
      >
        <input type="hidden" name="deliverableId" value={item.id} />
        {item.status === DELIVERABLE_STATUS.SUBMITTED ? (
          <input type="hidden" name="status" value={item.status} />
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor={`status-${item.id}`} className="text-xs">
            Estado
          </Label>
          <select
            id={`status-${item.id}`}
            name="status"
            defaultValue={item.status}
            disabled={!canEdit || item.status === DELIVERABLE_STATUS.SUBMITTED}
            className={controlClass}
            onChange={onFieldChange}
          >
            {(item.status === DELIVERABLE_STATUS.SUBMITTED
              ? [...OPS_DELIVERABLE_STATUSES, DELIVERABLE_STATUS.SUBMITTED]
              : OPS_DELIVERABLE_STATUSES
            ).map((status) => (
              <option
                key={status}
                value={status}
                disabled={
                  status === DELIVERABLE_STATUS.PUBLISHED &&
                  !item.contractSigned &&
                  item.status !== DELIVERABLE_STATUS.PUBLISHED
                }
              >
                {DELIVERABLE_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`contentDate-${item.id}`} className="text-xs">
            Fecha
          </Label>
          <input
            id={`contentDate-${item.id}`}
            type="date"
            name="contentDate"
            defaultValue={item.contentDate ?? ""}
            disabled={!canEdit}
            className={controlClass}
            onChange={onFieldChange}
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
            onChange={onFieldChange}
          >
            <option value="">Sin campaña</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.clientName
                  ? `${campaign.name} · ${campaign.clientName}`
                  : campaign.name}
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
            onChange={onFieldChange}
            onBlur={onUrlBlur}
          />
        </div>

        {errorText ? (
          <p className="text-xs text-destructive sm:col-span-4">{errorText}</p>
        ) : null}
      </form>

      <PublishConfirmDialog
        open={publishOpen}
        costMinor={item.costMinor}
        costCurrency={item.costCurrency}
        pack={item.pack}
        onConfirm={confirmPublish}
        onCancel={cancelPublish}
      />
    </li>
  );
}

export function DeliverableList({
  deliverables,
  campaigns,
  canEdit,
}: {
  deliverables: DeliverableItem[];
  campaigns: { id: string; name: string; clientName?: string | null }[];
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
        Publicado es que ya está en redes, con enlace y fecha. Submitted lo
        marca Finanzas solo en clientes con plataforma. En clientes pack no se
        cobra ni se paga hasta completar los contenidos de ese perfil en la
        campaña.
      </p>
    </div>
  );
}
