"use client";

import { ExternalLinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  DELIVERABLE_STATUS,
  DELIVERABLE_STATUS_LABELS,
  OPS_DELIVERABLE_STATUSES,
} from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

import { PublishConfirmDialog } from "./publish-confirm-dialog";
import { useDeliverableAutosave } from "./use-deliverable-autosave";

export type ContentRowData = {
  id: string;
  position: number;
  status: string;
  campaignId: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  paymentDueAt: string | null;
  postUrl: string | null;
  isLate: boolean;
  costMinor: number;
  costCurrency: string;
  creatorHandle: string;
  creatorId: string;
  contractId: string;
  contractCode: string;
  contractSigned: boolean;
};

const inputClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

function editorKey(item: ContentRowData) {
  return [
    item.id,
    item.status,
    item.scheduledFor ?? "",
    item.publishedAt ?? "",
    item.campaignId ?? "",
    item.postUrl ?? "",
  ].join(":");
}

export function ContentRow({
  item,
  campaigns,
  canEdit,
}: {
  item: ContentRowData;
  campaigns: { id: string; name: string }[];
  canEdit: boolean;
}) {
  return (
    <ContentRowFields
      key={editorKey(item)}
      item={item}
      campaigns={campaigns}
      canEdit={canEdit}
    />
  );
}

function ContentRowFields({
  item,
  campaigns,
  canEdit,
}: {
  item: ContentRowData;
  campaigns: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const {
    formRef,
    formAction,
    pending,
    state,
    publishOpen,
    onFieldChange,
    onUrlBlur,
    confirmPublish,
    cancelPublish,
  } = useDeliverableAutosave(item, canEdit);

  const formId = `row-${item.id}`;

  return (
    <>
      <TableRow className={item.isLate ? "bg-destructive/5" : undefined}>
        <TableCell className="align-middle">
          {canEdit ? (
            <input
              type="checkbox"
              name="deliverableIds"
              value={item.id}
              form="bulk-campaign"
              aria-label={`Seleccionar contenido ${item.position} de ${item.creatorHandle}`}
              className="size-4 accent-primary"
            />
          ) : null}
        </TableCell>

        <TableCell className="whitespace-nowrap">
          <a
            href={`/creators/${item.creatorId}`}
            className="font-medium hover:underline"
          >
            @{item.creatorHandle}
          </a>
          <p className="text-xs text-muted-foreground">
            <a href={`/contratos/${item.contractId}`} className="hover:underline">
              {item.contractCode}
            </a>{" "}
            · nº {item.position}
          </p>
        </TableCell>

        <TableCell>
          <select
            name="campaignId"
            form={formId}
            defaultValue={item.campaignId ?? ""}
            disabled={!canEdit}
            className={inputClass}
            aria-label="Campaña"
            onChange={onFieldChange}
          >
            <option value="">Sin campaña</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </TableCell>

        <TableCell>
          <select
            name="status"
            form={formId}
            defaultValue={item.status}
            disabled={!canEdit || item.status === DELIVERABLE_STATUS.SUBMITTED}
            className={inputClass}
            aria-label="Estado"
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
          {item.isLate ? (
            <Badge variant="destructive" className="mt-1">
              Fecha pasada
            </Badge>
          ) : null}
          {!item.contractSigned ? (
            <Badge variant="outline" className="mt-1">
              Sin firmar
            </Badge>
          ) : null}
        </TableCell>

        <TableCell>
          <input
            type="date"
            name="scheduledFor"
            form={formId}
            defaultValue={item.scheduledFor ?? ""}
            disabled={!canEdit}
            className={inputClass}
            aria-label="Fecha prevista"
            onChange={onFieldChange}
          />
        </TableCell>

        <TableCell>
          <input
            type="date"
            name="publishedAt"
            form={formId}
            defaultValue={item.publishedAt ?? ""}
            disabled={!canEdit}
            className={inputClass}
            aria-label="Fecha de publicación"
            onChange={onFieldChange}
          />
        </TableCell>

        <TableCell>
          <input
            type="url"
            name="postUrl"
            form={formId}
            defaultValue={item.postUrl ?? ""}
            disabled={!canEdit}
            placeholder="https://…"
            className={inputClass}
            aria-label="Enlace del post"
            onChange={onFieldChange}
            onBlur={onUrlBlur}
          />
          {item.postUrl ? (
            <a
              href={item.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4"
            >
              Abrir
              <ExternalLinkIcon className="size-3" />
            </a>
          ) : null}
        </TableCell>

        <TableCell className="whitespace-nowrap text-sm">
          {formatMoney(item.costMinor, item.costCurrency)}
        </TableCell>

        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
          {item.paymentDueAt ? formatDate(item.paymentDueAt) : "—"}
        </TableCell>

        <TableCell className="text-xs text-muted-foreground">
          <form id={formId} ref={formRef} action={formAction}>
            <input type="hidden" name="deliverableId" value={item.id} />
            {item.status === DELIVERABLE_STATUS.SUBMITTED ? (
              <input type="hidden" name="status" value={item.status} />
            ) : null}
            <button type="submit" className="sr-only">
              Guardar
            </button>
          </form>
          {pending ? "Guardando…" : null}
        </TableCell>
      </TableRow>

      {state?.error || state?.fieldErrors ? (
        <TableRow>
          <TableCell colSpan={10} className="pt-0">
            <p className="text-xs text-destructive">
              {state.error ??
                Object.values(state.fieldErrors ?? {}).join(" · ")}
            </p>
          </TableCell>
        </TableRow>
      ) : null}

      <PublishConfirmDialog
        open={publishOpen}
        costMinor={item.costMinor}
        costCurrency={item.costCurrency}
        onConfirm={confirmPublish}
        onCancel={cancelPublish}
      />
    </>
  );
}
