"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { recordAudit } from "@/lib/domain/audit";
import { upsertFxRate } from "@/lib/domain/fx";
import { fieldErrorsFrom, fxRateFormSchema } from "@/lib/domain/validation";

export type EstadoActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function saveFxRate(
  _prev: EstadoActionResult | null,
  formData: FormData
): Promise<EstadoActionResult> {
  const user = await requirePermission("contracts:write", "/estado");

  const parsed = fxRateFormSchema.safeParse({
    currency: formData.get("currency"),
    unitsPerUsd: formData.get("unitsPerUsd"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  if (parsed.data.currency === "USD") {
    return { ok: false, error: "USD no necesita tipo de cambio." };
  }

  await upsertFxRate(parsed.data.currency, parsed.data.unitsPerUsd);

  await recordAudit({
    entityType: "FxRate",
    entityId: parsed.data.currency,
    action: "FX_UPDATED",
    actor: user,
    metadata: { unitsPerUsd: parsed.data.unitsPerUsd },
  });

  revalidatePath("/estado");
  revalidatePath("/");
  return { ok: true };
}
