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
import { parseMedianViews } from "@/lib/domain/median-views";
import { parseRosterTable } from "@/lib/domain/roster-import";
import { upsertRosterCreator } from "@/lib/domain/roster-upsert";
import { extractInstagramHandle } from "@/lib/domain/instagram-handle";

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

  const views = parseMedianViews(String(formData.get("igMedianViews") ?? ""));
  if (!views.ok) return { ok: false, error: views.error };

  const result = await upsertRosterCreator({
    handle,
    country: resolved.country,
    profileType: resolved.profileType,
    igMedianViews: views.views,
    createdBy: user.email,
  });

  await recordAudit({
    entityType: "Creator",
    entityId: result.creator.id,
    action: result.created ? "ROSTER_CREATED" : "ROSTER_UPDATED",
    actor: user,
    metadata: { handle, igMedianViews: views.views },
  });

  revalidatePath("/creators");
  revalidatePath(`/creators/${result.creator.id}`);
  revalidatePath("/");
  return {
    ok: true,
    created: result.created ? 1 : 0,
    updated: result.updated ? 1 : 0,
    creatorId: result.creator.id,
  };
}

export async function updateCreatorMedianViews(
  _prev: RosterWriteResult | null,
  formData: FormData
): Promise<RosterWriteResult> {
  const user = await requirePermission("creators:write", "/creators");
  const creatorId = String(formData.get("creatorId") ?? "");
  if (!creatorId) return { ok: false, error: "Falta el perfil." };

  const views = parseMedianViews(String(formData.get("igMedianViews") ?? ""));
  if (!views.ok) return { ok: false, error: views.error };

  const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
  if (!creator) return { ok: false, error: "Ese perfil no existe." };

  await prisma.creator.update({
    where: { id: creatorId },
    data: { igMedianViews: views.views, igMedianViewsAt: new Date() },
  });

  await recordAudit({
    entityType: "Creator",
    entityId: creatorId,
    action: "MEDIAN_VIEWS_SET",
    actor: user,
    metadata: { igMedianViews: views.views },
  });

  revalidatePath("/creators");
  revalidatePath(`/creators/${creatorId}`);
  revalidatePath("/");
  return { ok: true, creatorId };
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

    let igMedianViews: number | undefined;
    if (row.medianViews) {
      const views = parseMedianViews(row.medianViews);
      if (!views.ok) {
        issues.push({ line: row.line, message: views.error });
        continue;
      }
      igMedianViews = views.views;
    }

    const result = await upsertRosterCreator({
      handle: row.handle,
      country: resolved.country,
      profileType: resolved.profileType,
      igMedianViews,
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
