import { prisma } from "@/lib/db";
import {
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
  LIST_PAGE_SIZE,
} from "@/lib/domain/enums";
import { parsePage, queryHref } from "@/lib/domain/paging";

export type CreatorListFilters = {
  q?: string;
  pagina?: string;
};

const liveStatuses = [
  DELIVERABLE_STATUS.PUBLISHED,
  DELIVERABLE_STATUS.SUBMITTED,
];

export function creatorsHref(filters: CreatorListFilters, page = 1) {
  return queryHref("/creators", { q: filters.q }, page);
}

export async function loadCreatorsPage(filters: CreatorListFilters) {
  const page = parsePage(filters.pagina);
  const query = filters.q?.trim() ?? "";
  const where = query
    ? {
        OR: [
          { handle: { contains: query } },
          { displayName: { contains: query } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.creator.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * LIST_PAGE_SIZE,
      take: LIST_PAGE_SIZE,
      select: {
        id: true,
        handle: true,
        displayName: true,
        createdAt: true,
        contracts: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            costCurrency: true,
            costMinorPerContent: true,
            deliverableCount: true,
            _count: {
              select: {
                deliverables: { where: { status: { in: liveStatuses } } },
              },
            },
          },
        },
      },
    }),
    prisma.creator.count({ where }),
  ]);

  return {
    page,
    pageSize: LIST_PAGE_SIZE,
    total,
    query,
    rows: rows.map((creator) => {
      const activeContracts = creator.contracts.filter(
        (contract) => contract.status !== CONTRACT_STATUS.CANCELLED
      );
      const published = creator.contracts.reduce(
        (sum, contract) => sum + contract._count.deliverables,
        0
      );
      const totalDeliverables = creator.contracts.reduce(
        (sum, contract) => sum + contract.deliverableCount,
        0
      );
      const costByCurrency = activeContracts.reduce<Record<string, number>>(
        (accumulator, contract) => {
          accumulator[contract.costCurrency] =
            (accumulator[contract.costCurrency] ?? 0) +
            contract.costMinorPerContent * contract.deliverableCount;
          return accumulator;
        },
        {}
      );

      return {
        id: creator.id,
        handle: creator.handle,
        displayName: creator.displayName,
        createdAt: creator.createdAt,
        contractCount: creator.contracts.length,
        published,
        totalDeliverables,
        costByCurrency,
        latestStatus: creator.contracts[0]?.status ?? null,
      };
    }),
  };
}
