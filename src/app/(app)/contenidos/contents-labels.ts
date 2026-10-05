import {
  DELIVERABLE_STATUS_LABELS,
  type DeliverableStatus,
} from "@/lib/domain/enums";
import type { ContentRowData } from "@/lib/domain/contents";
import type { StatusTone } from "@/components/status-pill";

export function contentTone(row: ContentRowData): StatusTone {
  if (row.platformSubmitError || row.isLate) return "destructive";
  if (row.status === "PUBLISHED" || row.status === "SUBMITTED") return "success";
  if (row.status === "SCHEDULED") return "info";
  return "neutral";
}

export function contentLabel(row: ContentRowData) {
  if (row.paidAt) return "Pagado";
  if (row.platformSubmitError) return "Rechazado por plataforma";
  if (row.isLate) return "Fecha pasada";
  return DELIVERABLE_STATUS_LABELS[row.status as DeliverableStatus] ?? row.status;
}
