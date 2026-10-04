import { prisma } from "@/lib/db";
import { instagramUrlFor } from "@/lib/domain/validation";

export async function upsertRosterCreator(input: {
  handle: string;
  country?: string | null;
  profileType?: string | null;
  defaultCostMinor?: number | null;
  defaultCostCurrency?: string | null;
  createdBy: string;
}) {
  const existing = await prisma.creator.findUnique({
    where: { handle: input.handle },
  });

  if (!existing) {
    const created = await prisma.creator.create({
      data: {
        handle: input.handle,
        instagramUrl: instagramUrlFor(input.handle),
        country: input.country || null,
        profileType: input.profileType || null,
        defaultCostMinor: input.defaultCostMinor || null,
        defaultCostCurrency: input.defaultCostCurrency || null,
        payoutCurrency: input.defaultCostCurrency || "EUR",
        createdBy: input.createdBy,
      },
    });
    return { creator: created, created: true, updated: false };
  }

  const data: {
    country?: string;
    profileType?: string;
    defaultCostMinor?: number;
    defaultCostCurrency?: string;
  } = {};
  if (!existing.country && input.country) data.country = input.country;
  if (!existing.profileType && input.profileType) {
    data.profileType = input.profileType;
  }
  if (!existing.defaultCostMinor && input.defaultCostMinor) {
    data.defaultCostMinor = input.defaultCostMinor;
    if (input.defaultCostCurrency) {
      data.defaultCostCurrency = input.defaultCostCurrency;
    }
  }

  if (Object.keys(data).length === 0) {
    return { creator: existing, created: false, updated: false };
  }

  const updated = await prisma.creator.update({
    where: { id: existing.id },
    data,
  });
  return { creator: updated, created: false, updated: true };
}
