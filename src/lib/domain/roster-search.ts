import { prisma } from "@/lib/db";
import { CREATOR_SEARCH_LIMIT } from "@/lib/domain/enums";

export async function searchRoster(query: string, take = CREATOR_SEARCH_LIMIT) {
  const term = query.trim();
  if (term.length < 1) return [];

  return prisma.creator.findMany({
    where: {
      OR: [
        { handle: { contains: term.replace(/^@/, "") } },
        { displayName: { contains: term } },
      ],
    },
    orderBy: { handle: "asc" },
    take,
    select: {
      id: true,
      handle: true,
      displayName: true,
      contactEmail: true,
    },
  });
}
