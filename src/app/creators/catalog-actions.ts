"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import {
  ROSTER_OPTION_KIND,
  normalizeCatalogKey,
  type RosterOptionKind,
} from "@/lib/domain/roster-catalog";

export type CatalogWriteResult = {
  ok: boolean;
  error?: string;
};

function parseKind(value: unknown): RosterOptionKind | null {
  const kind = String(value ?? "");
  if (
    kind === ROSTER_OPTION_KIND.COUNTRY ||
    kind === ROSTER_OPTION_KIND.PROFILE_TYPE
  ) {
    return kind;
  }
  return null;
}

function parseAliasList(value: unknown) {
  return String(value ?? "")
    .split(/[,;\n]/)
    .map((item) => normalizeCatalogKey(item))
    .filter(Boolean);
}

export async function createRosterOption(
  _prev: CatalogWriteResult | null,
  formData: FormData
): Promise<CatalogWriteResult> {
  const user = await requirePermission("creators:write", "/creators/catalogo");
  const kind = parseKind(formData.get("kind"));
  const label = String(formData.get("label") ?? "").trim();
  if (!kind) return { ok: false, error: "Elige si es país o tipo." };
  if (label.length < 2) return { ok: false, error: "Pon un nombre de al menos 2 letras." };

  const slug = normalizeCatalogKey(label);
  if (!slug) return { ok: false, error: "Ese nombre no vale." };

  const existing = await prisma.rosterOption.findUnique({
    where: { kind_slug: { kind, slug } },
  });
  if (existing) {
    return { ok: false, error: `«${existing.label}» ya está en el catálogo.` };
  }

  const aliases = parseAliasList(formData.get("aliases"));
  const last = await prisma.rosterOption.findFirst({
    where: { kind },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.rosterOption.create({
    data: {
      kind,
      slug,
      label,
      aliases: JSON.stringify(aliases),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  await recordAudit({
    entityType: "RosterOption",
    entityId: `${kind}:${slug}`,
    action: "CREATED",
    actor: user,
    metadata: { label, aliases },
  });

  revalidatePath("/creators");
  revalidatePath("/creators/catalogo");
  revalidatePath("/campanas");
  return { ok: true };
}

export async function addRosterOptionAliases(
  _prev: CatalogWriteResult | null,
  formData: FormData
): Promise<CatalogWriteResult> {
  const user = await requirePermission("creators:write", "/creators/catalogo");
  const id = String(formData.get("optionId") ?? "");
  const extra = parseAliasList(formData.get("aliases"));
  if (!id || extra.length === 0) {
    return { ok: false, error: "Escribe al menos un alias (españa, es, spain…)." };
  }

  const option = await prisma.rosterOption.findUnique({ where: { id } });
  if (!option) return { ok: false, error: "Esa opción no existe." };

  let current: string[] = [];
  try {
    const parsed = JSON.parse(option.aliases);
    if (Array.isArray(parsed)) {
      current = parsed.filter((item): item is string => typeof item === "string");
    }
  } catch {
    current = [];
  }

  const aliases = [...new Set([...current, ...extra])];
  await prisma.rosterOption.update({
    where: { id },
    data: { aliases: JSON.stringify(aliases) },
  });

  await recordAudit({
    entityType: "RosterOption",
    entityId: id,
    action: "ALIASES_ADDED",
    actor: user,
    metadata: { extra },
  });

  revalidatePath("/creators");
  revalidatePath("/creators/catalogo");
  return { ok: true };
}

export async function archiveRosterOption(formData: FormData) {
  const user = await requirePermission("creators:write", "/creators/catalogo");
  const id = String(formData.get("optionId") ?? "");
  const archived = String(formData.get("archived") ?? "") === "1";
  if (!id) throw new Error("Falta la opción.");

  await prisma.rosterOption.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });

  await recordAudit({
    entityType: "RosterOption",
    entityId: id,
    action: archived ? "ARCHIVED" : "RESTORED",
    actor: user,
  });

  revalidatePath("/creators");
  revalidatePath("/creators/catalogo");
}
