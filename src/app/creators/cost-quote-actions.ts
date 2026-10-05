"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { parseCostQuoteInput } from "@/lib/domain/creator-cost-quote";

export type CostQuoteResult = {
  ok: boolean;
  error?: string;
};

export async function saveCreatorCostQuote(
  _prev: CostQuoteResult | null,
  formData: FormData
): Promise<CostQuoteResult> {
  const user = await requirePermission("creators:write", "/creators");
  const creatorId = String(formData.get("creatorId") ?? "");
  if (!creatorId) return { ok: false, error: "Falta el perfil." };

  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    select: { id: true },
  });
  if (!creator) return { ok: false, error: "Ese perfil no existe." };

  const parsed = parseCostQuoteInput({
    platform: String(formData.get("platform") ?? ""),
    format: String(formData.get("format") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    currency: String(formData.get("currency") ?? "EUR"),
  });
  if (!parsed.ok) return parsed;

  const quote = await prisma.creatorCostQuote.upsert({
    where: {
      creatorId_platform_format_quantity: {
        creatorId,
        platform: parsed.platform,
        format: parsed.format,
        quantity: parsed.quantity,
      },
    },
    create: {
      creatorId,
      platform: parsed.platform,
      format: parsed.format,
      quantity: parsed.quantity,
      costMinor: parsed.costMinor,
      currency: parsed.currency,
    },
    update: {
      costMinor: parsed.costMinor,
      currency: parsed.currency,
    },
  });

  await recordAudit({
    entityType: "CreatorCostQuote",
    entityId: quote.id,
    action: "COST_QUOTE_SET",
    actor: user,
    metadata: {
      creatorId,
      platform: parsed.platform,
      format: parsed.format,
      quantity: parsed.quantity,
      currency: parsed.currency,
    },
  });

  revalidatePath("/creators");
  revalidatePath(`/creators/${creatorId}`);
  revalidatePath("/campanas");
  return { ok: true };
}

export async function deleteCreatorCostQuote(formData: FormData) {
  const user = await requirePermission("creators:write", "/creators");
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return;

  const quote = await prisma.creatorCostQuote.findUnique({
    where: { id: quoteId },
  });
  if (!quote) return;

  await prisma.creatorCostQuote.delete({ where: { id: quoteId } });

  await recordAudit({
    entityType: "CreatorCostQuote",
    entityId: quoteId,
    action: "COST_QUOTE_REMOVED",
    actor: user,
    metadata: {
      creatorId: quote.creatorId,
      platform: quote.platform,
      format: quote.format,
      quantity: quote.quantity,
    },
  });

  revalidatePath("/creators");
  revalidatePath(`/creators/${quote.creatorId}`);
  revalidatePath("/campanas");
}
