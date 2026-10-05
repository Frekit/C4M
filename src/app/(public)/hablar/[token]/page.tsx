import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { notFound } from "next/navigation";

import { BriefRead } from "@/app/(app)/campanas/[id]/brief-form";
import { clientThreadWhere } from "@/lib/agent/messages";
import { prisma } from "@/lib/db";
import { assembleBriefing, renderClientStatus } from "@/lib/domain/campaign-briefing";
import { loadCampaignResults } from "@/lib/domain/campaign-results";
import { loadCampaignSheet } from "@/lib/domain/campaign-sheet";

import { ClientThreadForm } from "./client-thread";

export const metadata: Metadata = {
  title: "Conversación",
};

export default async function ClientTalkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { clientAccessToken: token },
    select: { id: true, name: true },
  });
  if (!campaign) notFound();

  const [sheet, results, messages] = await Promise.all([
    loadCampaignSheet(campaign.id),
    loadCampaignResults(campaign.id),
    prisma.campaignMessage.findMany({
      where: clientThreadWhere(campaign.id),
      orderBy: { createdAt: "asc" },
      select: { id: true, authorKind: true, authorLabel: true, body: true },
    }),
  ]);
  if (!sheet) notFound();

  const packet = assembleBriefing({
    campaignName: sheet.campaign.name,
    clientName: sheet.campaign.client?.name ?? null,
    objective: sheet.campaign.briefObjective,
    audience: sheet.campaign.briefAudience,
    networks: sheet.campaign.briefNetworks,
    formats: sheet.campaign.briefFormats,
    notes: sheet.campaign.briefNotes,
    rows: sheet.rows,
    pulse: sheet.pulse,
    results,
  });
  const status = renderClientStatus(packet);

  return (
    <PageShell width="narrow" className="py-16">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {sheet.campaign.client?.name ?? "Campaña"}
        </p>
        <h1 className="font-heading text-3xl font-medium tracking-tight">
          {sheet.campaign.name}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Aquí hablas con la agencia. Ellos llevan la campaña: no hay que
          aprobar listas ni rellenar nada más.
        </p>
      </header>

      <section className="rounded-xl border bg-card p-4">
        <p className="text-sm leading-relaxed">{status}</p>
      </section>

      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Encargo
        </h2>
        <div className="mt-3">
          <BriefRead
            objective={sheet.campaign.briefObjective}
            audience={sheet.campaign.briefAudience}
            networks={sheet.campaign.briefNetworks}
            formats={sheet.campaign.briefFormats}
            notes={sheet.campaign.briefNotes}
          />
        </div>
      </section>

      <ClientThreadForm token={token} messages={messages} />
    </PageShell>
  );
}
