import { NextRequest } from "next/server";

import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { FINANCE_MAX_IDS } from "@/lib/domain/enums";
import { listPlatformReadyUrls } from "@/lib/domain/finance";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "finance:manage")) {
    return new Response("No tienes permiso para exportar esta cola.", {
      status: 403,
    });
  }

  const campaignId = request.nextUrl.searchParams.get("campana")?.trim();
  if (!campaignId) {
    return new Response("Elige una campaña.", { status: 400 });
  }

  const urls = await listPlatformReadyUrls([campaignId], FINANCE_MAX_IDS);
  const body = urls.length > 0 ? `${urls.join("\n")}\n` : "";

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="plataforma-${campaignId}.txt"`,
    },
  });
}
