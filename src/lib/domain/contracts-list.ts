import { prisma } from "@/lib/db";
import {
  CONTRACT_STATUS,
  CONTRACT_STATUS_LABELS,
  DELIVERABLE_STATUS,
  LIST_PAGE_SIZE,
  type ContractStatus,
} from "@/lib/domain/enums";
import { parsePage, queryHref } from "@/lib/domain/paging";

export type ContractListFilters = {
  campana?: string;
  estado?: string;
  pagina?: string;
};

const liveStatuses = [
  DELIVERABLE_STATUS.PUBLISHED,
  DELIVERABLE_STATUS.SUBMITTED,
];

export function contractsHref(filters: ContractListFilters, page = 1) {
  return queryHref(
    "/contratos",
    { campana: filters.campana, estado: filters.estado },
    page
  );
}

export async function loadContractsPage(filters: ContractListFilters) {
  const page = parsePage(filters.pagina);
  const status =
    filters.estado && filters.estado in CONTRACT_STATUS_LABELS
      ? (filters.estado as ContractStatus)
      : undefined;

  const where = {
    ...(filters.campana
      ? { deliverables: { some: { campaignId: filters.campana } } }
      : {}),
    ...(status ? { status } : {}),
  };

  const unsignedWhere =
    status &&
    status !== CONTRACT_STATUS.DRAFT &&
    status !== CONTRACT_STATUS.SENT
      ? { id: "__none__" }
      : {
          ...(filters.campana
            ? { deliverables: { some: { campaignId: filters.campana } } }
            : {}),
          status: status ?? {
            in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT],
          },
        };

  const [rows, total, unsignedCount, campaigns] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * LIST_PAGE_SIZE,
      take: LIST_PAGE_SIZE,
      select: {
        id: true,
        code: true,
        kind: true,
        status: true,
        createdAt: true,
        creatorId: true,
        deliverableCount: true,
        costCurrency: true,
        costMinorPerContent: true,
        salePriceCentsPerContent: true,
        creator: { select: { handle: true } },
        client: { select: { name: true } },
        _count: {
          select: {
            deliverables: { where: { status: { in: liveStatuses } } },
          },
        },
      },
    }),
    prisma.contract.count({ where }),
    prisma.contract.count({ where: unsignedWhere }),
    prisma.campaign.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    page,
    pageSize: LIST_PAGE_SIZE,
    total,
    unsignedCount,
    campaigns,
    rows,
  };
}
