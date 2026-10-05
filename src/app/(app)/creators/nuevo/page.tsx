import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

import { CreatorForm } from "./creator-form";

export const metadata: Metadata = {
  title: "Registrar influencer",
};

async function latestFxRates(): Promise<Record<string, number>> {
  const rates = await prisma.fxRate.findMany({ orderBy: { date: "asc" } });

  return rates.reduce<Record<string, number>>((accumulator, rate) => {
    accumulator[rate.currency] = rate.unitsPerUsd;
    return accumulator;
  }, {});
}

export default async function NewCreatorPage() {
  await requirePermission("creators:write", "/creators/nuevo");
  const [fxRates, clients, campaigns] = await Promise.all([
    latestFxRates(),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.campaign.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, clientId: true },
    }),
  ]);

  return (
    <PageShell width="default">
      <div className="space-y-1">
        <h1 className="text-heading-24">
          Registrar influencer
        </h1>
        <p className="text-sm text-muted-foreground">
          Al guardar se crea su contrato con un cliente, listo para enviar a
          firma.
        </p>
      </div>

      <CreatorForm fxRates={fxRates} clients={clients} campaigns={campaigns} />
    </PageShell>
  );
}
