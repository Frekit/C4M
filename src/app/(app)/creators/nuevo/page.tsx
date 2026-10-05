import type { Metadata } from "next";

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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Registrar influencer
        </h1>
        <p className="text-sm text-muted-foreground">
          Al guardar se crea su contrato con un cliente, listo para enviar a
          firma.
        </p>
      </div>

      <CreatorForm fxRates={fxRates} clients={clients} campaigns={campaigns} />
    </main>
  );
}
