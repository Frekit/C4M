import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CREATOR_SEARCH_LIMIT } from "@/lib/domain/enums";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sin sesión" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 1) {
    return Response.json({ items: [] });
  }

  const items = await prisma.creator.findMany({
    where: {
      OR: [
        { handle: { contains: query } },
        { displayName: { contains: query } },
      ],
    },
    orderBy: { handle: "asc" },
    take: CREATOR_SEARCH_LIMIT,
    select: { id: true, handle: true, displayName: true },
  });

  return Response.json({ items });
}
