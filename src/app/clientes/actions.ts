"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { clientUpdateSchema, fieldErrorsFrom } from "@/lib/domain/validation";

export type ClientActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
};

export async function updateClient(
  _prev: ClientActionResult | null,
  formData: FormData
): Promise<ClientActionResult> {
  const user = await requirePermission("campaigns:manage", "/clientes");

  const parsed = clientUpdateSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    settlementMode: formData.get("settlementMode"),
    requiresPlatformSubmit: formData.get("requiresPlatformSubmit"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const data = parsed.data;
  const existing = await prisma.client.findUnique({ where: { id: data.clientId } });

  if (!existing) {
    return { ok: false, error: "Ese cliente no existe." };
  }

  const duplicate = await prisma.client.findFirst({
    where: { name: data.name, id: { not: data.clientId } },
  });

  if (duplicate) {
    return { ok: false, fieldErrors: { name: "Ya hay un cliente con ese nombre." } };
  }

  await prisma.client.update({
    where: { id: data.clientId },
    data: {
      name: data.name,
      settlementMode: data.settlementMode,
      requiresPlatformSubmit: data.requiresPlatformSubmit,
      notes: data.notes || null,
    },
  });

  await recordAudit({
    entityType: "Client",
    entityId: data.clientId,
    action: "UPDATED",
    actor: user,
    metadata: {
      from: {
        name: existing.name,
        settlementMode: existing.settlementMode,
        requiresPlatformSubmit: existing.requiresPlatformSubmit,
      },
      to: {
        name: data.name,
        settlementMode: data.settlementMode,
        requiresPlatformSubmit: data.requiresPlatformSubmit,
      },
    },
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${data.clientId}`);
  revalidatePath("/campanas");
  revalidatePath("/finanzas");
  revalidatePath("/contenidos");

  return { ok: true, message: "Cliente actualizado." };
}
