import type { Prisma } from "@prisma/client";

import {
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
  DELIVERABLE_STATUS_ORDER,
  type DeliverableStatus,
} from "@/lib/domain/enums";

export const CONTENTS_PAGE_SIZE = 60;

export type ContentFilters = {
  creador?: string;
  campana?: string;
  estado?: string;
  desde?: string;
  hasta?: string;
  retrasados?: string;
  sinEnlace?: string;
  errorPlataforma?: string;
  sinFirmar?: string;
  pagina?: string;
};

const LIVE_STATUSES: DeliverableStatus[] = [
  DELIVERABLE_STATUS.PUBLISHED,
  DELIVERABLE_STATUS.SUBMITTED,
];

export function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export function contentsHref(filters: ContentFilters, page = 1): string {
  const params = new URLSearchParams();

  if (filters.creador) params.set("creador", filters.creador);
  if (filters.campana) params.set("campana", filters.campana);
  if (filters.estado) params.set("estado", filters.estado);
  if (filters.desde) params.set("desde", filters.desde);
  if (filters.hasta) params.set("hasta", filters.hasta);
  if (filters.retrasados === "1") params.set("retrasados", "1");
  if (filters.sinEnlace === "1") params.set("sinEnlace", "1");
  if (filters.errorPlataforma === "1") params.set("errorPlataforma", "1");
  if (filters.sinFirmar === "1") params.set("sinFirmar", "1");
  if (page > 1) params.set("pagina", String(page));

  const query = params.toString();
  return query ? `/contenidos?${query}` : "/contenidos";
}

export function buildDeliverableWhere(
  filters: ContentFilters
): Prisma.DeliverableWhereInput {
  const contractFilter: Prisma.ContractWhereInput = {
    status: { not: CONTRACT_STATUS.CANCELLED },
  };

  if (filters.creador) {
    contractFilter.creatorId = filters.creador;
  }

  const where: Prisma.DeliverableWhereInput = { contract: contractFilter };

  if (filters.campana) {
    where.campaignId = filters.campana === "sin" ? null : filters.campana;
  }

  if (
    filters.estado &&
    DELIVERABLE_STATUS_ORDER.includes(filters.estado as DeliverableStatus)
  ) {
    where.status = filters.estado;
  }

  if (filters.desde || filters.hasta) {
    const range: Prisma.DateTimeNullableFilter = {};
    if (filters.desde) range.gte = new Date(`${filters.desde}T00:00:00.000Z`);
    if (filters.hasta) range.lte = new Date(`${filters.hasta}T23:59:59.999Z`);

    where.OR = [{ scheduledFor: range }, { publishedAt: range }];
  }

  if (filters.retrasados === "1") {
    where.status = {
      notIn: [
        DELIVERABLE_STATUS.PUBLISHED,
        DELIVERABLE_STATUS.SUBMITTED,
      ],
    };
    where.scheduledFor = { lt: new Date() };
  }

  if (filters.sinEnlace === "1") {
    where.status = DELIVERABLE_STATUS.PUBLISHED;
    where.postUrl = null;
  }

  if (filters.errorPlataforma === "1") {
    where.platformSubmitError = { not: null };
  }

  if (filters.sinFirmar === "1") {
    contractFilter.status = {
      in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT],
    };
    where.contract = contractFilter;
  }

  return where;
}

export function withLiveStatus(
  where: Prisma.DeliverableWhereInput
): Prisma.DeliverableWhereInput | null {
  const status = where.status;

  if (typeof status === "string") {
    if (
      status !== DELIVERABLE_STATUS.PUBLISHED &&
      status !== DELIVERABLE_STATUS.SUBMITTED
    ) {
      return null;
    }
    return where;
  }

  if (status && typeof status === "object" && "notIn" in status) {
    return null;
  }

  return {
    AND: [where, { status: { in: LIVE_STATUSES } }],
  };
}

export function buildLateDeliverableWhere(
  filters: ContentFilters,
  now = new Date()
): Prisma.DeliverableWhereInput {
  return {
    AND: [
      buildDeliverableWhere(filters),
      {
        status: { notIn: LIVE_STATUSES },
        scheduledFor: { lt: now },
      },
    ],
  };
}

export function statusCountsFromGroup(
  groups: { status: string; _count: { _all: number } }[]
): Record<string, number> {
  const counts = DELIVERABLE_STATUS_ORDER.reduce<Record<string, number>>(
    (accumulator, status) => {
      accumulator[status] = 0;
      return accumulator;
    },
    {}
  );

  for (const group of groups) {
    counts[group.status] = group._count._all;
  }

  return counts;
}

export function contentFiltersFromForm(formData: FormData): ContentFilters {
  const flag = (name: string) =>
    String(formData.get(name) ?? "") === "1" ? "1" : undefined;
  const text = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return value || undefined;
  };

  return {
    creador: text("filterCreador"),
    campana: text("filterCampana"),
    estado: text("filterEstado"),
    desde: text("filterDesde"),
    hasta: text("filterHasta"),
    retrasados: flag("filterRetrasados"),
    sinEnlace: flag("filterSinEnlace"),
    errorPlataforma: flag("filterErrorPlataforma"),
    sinFirmar: flag("filterSinFirmar"),
  };
}
