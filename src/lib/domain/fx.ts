import { prisma } from "@/lib/db";

export function startOfUtcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

export type ResolvedFxRate = {
  unitsPerUsd: number;
  rateAt: Date;
  source: string;
};

// Devuelve el cambio a aplicar: unidades de `currency` por 1 USD.
// Hoy se alimenta a mano (tabla FxRate); cuando entre el job diario contra una
// API de FX, solo cambia el origen, no las llamadas.
export async function resolveFxRate(
  currency: string,
  explicitRate?: number | null
): Promise<ResolvedFxRate> {
  const code = currency.toUpperCase();
  const today = startOfUtcDay();

  if (code === "USD") {
    return { unitsPerUsd: 1, rateAt: today, source: "FIXED" };
  }

  if (explicitRate && explicitRate > 0) {
    return { unitsPerUsd: explicitRate, rateAt: today, source: "MANUAL" };
  }

  const stored = await prisma.fxRate.findFirst({
    where: { currency: code, date: { lte: today } },
    orderBy: { date: "desc" },
  });

  if (stored) {
    return {
      unitsPerUsd: stored.unitsPerUsd,
      rateAt: stored.date,
      source: stored.source,
    };
  }

  return { unitsPerUsd: 0, rateAt: today, source: "MISSING" };
}

export async function upsertFxRate(
  currency: string,
  unitsPerUsd: number,
  source = "MANUAL"
) {
  const code = currency.toUpperCase();
  const date = startOfUtcDay();

  return prisma.fxRate.upsert({
    where: { currency_date: { currency: code, date } },
    create: { currency: code, date, unitsPerUsd, source },
    update: { unitsPerUsd, source },
  });
}
