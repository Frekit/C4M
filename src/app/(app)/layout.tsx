import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CAMPAIGN_STATUS } from "@/lib/domain/enums";
import { loadOpsAlerts } from "@/lib/domain/ops-alerts";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div id="contenido" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </div>
    );
  }

  const [alerts, campaigns] = await Promise.all([
    loadOpsAlerts(),
    prisma.campaign.findMany({
      where: { status: CAMPAIGN_STATUS.ACTIVE },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true },
    }),
  ]);

  const urgentCount =
    alerts.expiredCount +
    alerts.unsignedPublishedCount +
    alerts.missingLinkCount +
    alerts.platformErrorCount;

  return (
    <AppShell user={user} urgentCount={urgentCount} campaigns={campaigns}>
      {children}
    </AppShell>
  );
}
