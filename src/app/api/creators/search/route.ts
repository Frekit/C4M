import { NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { searchRoster } from "@/lib/domain/roster-search";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Sin sesión" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 1) {
    return Response.json({ items: [] });
  }

  const items = (await searchRoster(query)).map((item) => ({
    id: item.id,
    handle: item.handle,
    displayName: item.displayName,
  }));

  return Response.json({ items });
}
