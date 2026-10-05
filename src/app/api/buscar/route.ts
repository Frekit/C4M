import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sin sesión" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 1) {
    return Response.json({ contracts: [], campaigns: [], contents: [] });
  }

  const [contracts, campaigns, contents] = await Promise.all([
    prisma.contract.findMany({
      where: {
        OR: [
          { code: { contains: query } },
          { creator: { handle: { contains: query } } },
          { creator: { displayName: { contains: query } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        code: true,
        status: true,
        creator: { select: { handle: true, displayName: true } },
      },
    }),
    prisma.campaign.findMany({
      where: { name: { contains: query } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, name: true, status: true },
    }),
    prisma.deliverable.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { contract: { code: { contains: query } } },
          { contract: { creator: { handle: { contains: query } } } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        position: true,
        status: true,
        contract: {
          select: {
            id: true,
            code: true,
            creator: { select: { handle: true } },
          },
        },
      },
    }),
  ]);

  return Response.json({ contracts, campaigns, contents });
}
