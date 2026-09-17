"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { costPerContentUsdCents } from "@/lib/domain/contract-math";
import { campaignForClient } from "@/lib/domain/client-campaign";
import { createContract } from "@/lib/domain/contracts";
import { CONTRACT_KIND } from "@/lib/domain/enums";
import { resolveFxRate, upsertFxRate } from "@/lib/domain/fx";
import {
  createCreatorContractSchema,
  extractInstagramHandle,
  fieldErrorsFrom,
  instagramUrlFor,
} from "@/lib/domain/validation";
import { parseAmountToMinorUnits } from "@/lib/money";

export type CreateResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  existingCreatorId?: string;
};

export async function createCreatorWithContract(
  _prev: CreateResult | null,
  formData: FormData
): Promise<CreateResult> {
  const user = await requirePermission("creators:write", "/creators/nuevo");

  const parsed = createCreatorContractSchema.safeParse({
    instagram: formData.get("instagram"),
    displayName: formData.get("displayName"),
    contactEmail: formData.get("contactEmail"),
    deliverableCount: formData.get("deliverableCount"),
    salePricePerContent: formData.get("salePricePerContent"),
    costCurrency: formData.get("costCurrency"),
    costPerContent: formData.get("costPerContent"),
    fxUnitsPerUsd: formData.get("fxUnitsPerUsd"),
    paymentTermDays: formData.get("paymentTermDays"),
    notes: formData.get("notes"),
    clientId: formData.get("clientId"),
    campaignId: formData.get("campaignId"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const data = parsed.data;
  const handle = extractInstagramHandle(data.instagram);

  if (!handle) {
    return { ok: false, fieldErrors: { instagram: "Enlace no válido" } };
  }

  const existing = await prisma.creator.findUnique({ where: { handle } });

  if (existing) {
    return {
      ok: false,
      error: `@${handle} ya está registrado. Amplía su contrato de ese cliente, o ábrele uno nuevo con otro cliente desde su ficha.`,
      existingCreatorId: existing.id,
    };
  }

  const fx = await resolveFxRate(data.costCurrency, data.fxUnitsPerUsd);

  if (fx.unitsPerUsd <= 0) {
    return {
      ok: false,
      fieldErrors: {
        fxUnitsPerUsd: `No hay tipo de cambio guardado para ${data.costCurrency}. Escríbelo a mano.`,
      },
    };
  }

  if (data.fxUnitsPerUsd) {
    await upsertFxRate(data.costCurrency, data.fxUnitsPerUsd);
  }

  const salePriceCentsPerContent = parseAmountToMinorUnits(
    data.salePricePerContent,
    "USD"
  );
  const costMinorPerContent = parseAmountToMinorUnits(
    data.costPerContent,
    data.costCurrency
  );

  if (salePriceCentsPerContent === null || costMinorPerContent === null) {
    return { ok: false, error: "Revisa los importes." };
  }

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client) {
    return { ok: false, fieldErrors: { clientId: "Ese cliente no existe." } };
  }

  const matched = await campaignForClient(data.campaignId, client.id);
  if (!matched.ok) {
    return { ok: false, fieldErrors: { campaignId: matched.error } };
  }

  const creator = await prisma.creator.create({
    data: {
      handle,
      instagramUrl: instagramUrlFor(handle),
      displayName: data.displayName || null,
      contactEmail: data.contactEmail || null,
      payoutCurrency: data.costCurrency,
      createdBy: user.email,
    },
  });

  const contract = await createContract({
    creatorId: creator.id,
    kind: CONTRACT_KIND.ORIGINAL,
    clientId: client.id,
    campaignId: matched.campaignId,
    economics: {
      deliverableCount: data.deliverableCount,
      salePriceCentsPerContent,
      costCurrency: data.costCurrency,
      costMinorPerContent,
      costUsdCentsPerContent: costPerContentUsdCents(
        costMinorPerContent,
        data.costCurrency,
        fx.unitsPerUsd
      ),
      fxUnitsPerUsd: fx.unitsPerUsd,
      fxRateAt: fx.rateAt,
      fxSource: fx.source,
      paymentTermDays: data.paymentTermDays,
      notes: data.notes,
    },
    createdBy: user.email,
  });

  await recordAudit({
    entityType: "Contract",
    entityId: contract.id,
    action: "CREATED",
    actor: user,
    metadata: {
      code: contract.code,
      handle,
      deliverables: data.deliverableCount,
      clientId: client.id,
      campaignId: matched.campaignId,
    },
  });

  revalidatePath("/creators");
  revalidatePath("/contratos");
  revalidatePath("/contenidos");
  revalidatePath("/campanas");
  redirect(`/contratos/${contract.id}`);
}
