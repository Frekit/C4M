"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { ROSTER_IMPORT_MAX_ROWS } from "@/lib/domain/enums";
import {
  loadRosterCatalog,
  resolveRosterFields,
} from "@/lib/domain/roster-catalog";
import { parseRosterTable } from "@/lib/domain/roster-import";
import {
  extractInstagramHandle,
  instagramUrlFor,
} from "@/lib/domain/validation";

export type RosterWriteResult = {
  ok: boolean;
  error?: string;
  created?: number;
  updated?: number;
  skipped?: number;
  issues?: { line: number; message: string }[];
  creatorId?: string;
};

function optionalField(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function tableFromUpload(formData: FormData): Promise<string> {
  const pasted = String(formData.get("csv") ?? "").trim();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return pasted;
  }

  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), {
      type: "buffer",
    });
    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : null;
    if (!sheet) return pasted;
    return XLSX.utils.sheet_to_csv(sheet);
  }

  return await file.text();
}

export async function upsertRosterCreator(input: {
  handle: string;
  country?: string | null;
  profileType?: string | null;
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
        payoutCurrency: "EUR",
        createdBy: input.createdBy,
      },
    });
    return { creator: created, created: true, updated: false };
  }

  const data: { country?: string; profileType?: string } = {};
  if (!existing.country && input.country) data.country = input.country;
  if (!existing.profileType && input.profileType) {
    data.profileType = input.profileType;
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

export async function addRosterCreator(
  _prev: RosterWriteResult | null,
  formData: FormData
): Promise<RosterWriteResult> {
  const user = await requirePermission("creators:write", "/creators");
  const handle = extractInstagramHandle(String(formData.get("instagram") ?? ""));

  if (!handle) {
    return { ok: false, error: "Pon un Instagram válido (enlace o handle)." };
  }

  const resolved = resolveRosterFields(await loadRosterCatalog(), {
    country: optionalField(formData.get("country")),
    profileType: optionalField(formData.get("profileType")),
  });
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const result = await upsertRosterCreator({
    handle,
    country: resolved.country,
    profileType: resolved.profileType,
    createdBy: user.email,
  });

  await recordAudit({
    entityType: "Creator",
    entityId: result.creator.id,
    action: result.created ? "ROSTER_CREATED" : "ROSTER_UPDATED",
    actor: user,
    metadata: { handle },
  });

  revalidatePath("/creators");
  return {
    ok: true,
    created: result.created ? 1 : 0,
    updated: result.updated ? 1 : 0,
    creatorId: result.creator.id,
  };
}

export async function importRosterFile(
  _prev: RosterWriteResult | null,
  formData: FormData
): Promise<RosterWriteResult> {
  const user = await requirePermission("creators:write", "/creators/importar");
  const raw = await tableFromUpload(formData);
  const parsed = parseRosterTable(raw);

  if (parsed.rows.length === 0) {
    return {
      ok: false,
      error: parsed.errors[0]?.message ?? "El archivo no tiene filas válidas.",
      issues: parsed.errors,
    };
  }

  if (parsed.rows.length > ROSTER_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `Como máximo ${ROSTER_IMPORT_MAX_ROWS} filas por tanda.`,
    };
  }

  const catalog = await loadRosterCatalog();
  let created = 0;
  let updated = 0;
  const issues = [...parsed.errors];

  for (const row of parsed.rows) {
    const resolved = resolveRosterFields(catalog, {
      country: row.country,
      profileType: row.profileType,
    });
    if (!resolved.ok) {
      issues.push({ line: row.line, message: resolved.error });
      continue;
    }

    const result = await upsertRosterCreator({
      handle: row.handle,
      country: resolved.country,
      profileType: resolved.profileType,
      createdBy: user.email,
    });
    if (result.created) created += 1;
    else if (result.updated) updated += 1;
    else {
      issues.push({
        line: row.line,
        message: `@${row.handle} ya estaba en el roster.`,
      });
    }
  }

  if (created > 0) {
    await recordAudit({
      entityType: "Creator",
      entityId: "roster",
      action: "ROSTER_IMPORTED",
      actor: user,
      metadata: { created, updated, skipped: issues.length },
    });
  }

  revalidatePath("/creators");

  if (created === 0 && updated === 0) {
    return {
      ok: false,
      error: "Nadie nuevo. Revisa si esos Instagram ya están.",
      created: 0,
      updated: 0,
      skipped: issues.length,
      issues: issues.slice(0, 30),
    };
  }

  return {
    ok: true,
    created,
    updated,
    skipped: issues.length,
    issues: issues.slice(0, 30),
  };
}
