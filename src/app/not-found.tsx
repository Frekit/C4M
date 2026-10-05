import { AppShell } from "@/components/app-shell";
import { aiSetup } from "@/lib/agent/config";
import { NotFoundMessage } from "@/components/not-found-message";
import { PublicBrandHeader } from "@/components/public-brand-header";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadActionCenter } from "@/lib/domain/action-center";
import { CAMPAIGN_STATUS } from "@/lib/domain/enums";

export default async function NotFound() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <PublicBrandHeader />
        <div
          id="contenido"
          tabIndex={-1}
          className="flex flex-1 flex-col outline-none"
        >
          <NotFoundMessage />
        </div>
      </>
    );
  }

  const firstName = user.name.split(" ")[0] || user.name;
  const [center, campaigns] = await Promise.all([
    loadActionCenter(firstName),
    prisma.campaign.findMany({
      where: { status: CAMPAIGN_STATUS.ACTIVE },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true },
    }),
  ]);

  return (
    <AppShell user={user} urgentCount={center.urgentCount} campaigns={campaigns} aiSetup={aiSetup()}>
      <NotFoundMessage />
    </AppShell>
  );
}
