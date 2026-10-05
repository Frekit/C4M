import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CAMPAIGN_STATUS } from "@/lib/domain/enums";
import { loadActionCenter } from "@/lib/domain/action-center";

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

  const urgentCount = center.urgentCount;

  return (
    <AppShell user={user} urgentCount={urgentCount} campaigns={campaigns}>
      {children}
    </AppShell>
  );
}
