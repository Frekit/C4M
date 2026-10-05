"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/domain/audit";
import { costPerContentUsdCents } from "@/lib/domain/contract-math";
import { campaignForClient } from "@/lib/domain/client-campaign";
import { createContract } from "@/lib/domain/contracts";
import { CONTRACT_KIND, IMPORT_MAX_ROWS } from "@/lib/domain/enums";
import { parseCreatorCsv } from "@/lib/domain/creator-import";
import { resolveFxRate, upsertFxRate } from "@/lib/domain/fx";
import { isSupportedCurrency } from "@/lib/currencies";
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

export type ImportResult = {
  ok: boolean;
  error?: string;
  created?: number;
  skipped?: number;
  issues?: { line: number; message: string }[];
};

export async function importCreatorsCsv(
  _prev: ImportResult | null,
  formData: FormData
): Promise<ImportResult> {
  const user = await requirePermission("creators:write", "/creators/importar");
  const raw = String(formData.get("csv") ?? "");
  const parsed = parseCreatorCsv(raw);

  if (parsed.rows.length === 0) {
    return {
      ok: false,
      error: parsed.errors[0]?.message ?? "El CSV no tiene filas válidas.",
      issues: parsed.errors,
    };
  }

  if (parsed.rows.length > IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `Como máximo ${IMPORT_MAX_ROWS} filas por tanda. Parte el CSV.`,
    };
  }

  const [clients, campaigns] = await Promise.all([
    prisma.client.findMany({ select: { id: true, name: true } }),
    prisma.campaign.findMany({
      select: { id: true, name: true, clientId: true },
    }),
  ]);
  const clientByName = new Map(
    clients.map((client) => [client.name.toLowerCase(), client])
  );
  const campaignByName = new Map(
    campaigns.map((campaign) => [campaign.name.toLowerCase(), campaign])
  );

  let created = 0;
  const issues = [...parsed.errors];

  for (const row of parsed.rows) {
    const existing = await prisma.creator.findUnique({
      where: { handle: row.handle },
    });
    if (existing) {
      issues.push({
        line: row.line,
        message: `@${row.handle} ya está registrado.`,
      });
      continue;
    }

    const client = clientByName.get(row.client.toLowerCase());
    if (!client) {
      issues.push({
        line: row.line,
        message: `Cliente «${row.client}» no existe. Créalo en /clientes.`,
      });
      continue;
    }

    if (!isSupportedCurrency(row.currency)) {
      issues.push({
        line: row.line,
        message: `Moneda ${row.currency} no soportada.`,
      });
      continue;
    }

    const salePriceCentsPerContent = parseAmountToMinorUnits(row.saleUsd, "USD");
    const costMinorPerContent = parseAmountToMinorUnits(row.cost, row.currency);
    if (salePriceCentsPerContent === null || costMinorPerContent === null) {
      issues.push({ line: row.line, message: "Revisa los importes." });
      continue;
    }

    let campaignId: string | null = null;
    if (row.campaign) {
      const campaign = campaignByName.get(row.campaign.toLowerCase());
      if (!campaign) {
        issues.push({
          line: row.line,
          message: `Campaña «${row.campaign}» no existe.`,
        });
        continue;
      }
      if (campaign.clientId && campaign.clientId !== client.id) {
        issues.push({
          line: row.line,
          message: `La campaña «${row.campaign}» no es de ${row.client}.`,
        });
        continue;
      }
      campaignId = campaign.id;
    }

    const fx = await resolveFxRate(row.currency);
    if (fx.unitsPerUsd <= 0) {
      issues.push({
        line: row.line,
        message: `No hay tipo de cambio para ${row.currency}.`,
      });
      continue;
    }

    const creator = await prisma.creator.create({
      data: {
        handle: row.handle,
        instagramUrl: instagramUrlFor(row.handle),
        contactEmail: row.email,
        payoutCurrency: row.currency,
        createdBy: user.email,
      },
    });

    const contract = await createContract({
      creatorId: creator.id,
      kind: CONTRACT_KIND.ORIGINAL,
      clientId: client.id,
      campaignId,
      economics: {
        deliverableCount: row.deliverableCount,
        salePriceCentsPerContent,
        costCurrency: row.currency,
        costMinorPerContent,
        costUsdCentsPerContent: costPerContentUsdCents(
          costMinorPerContent,
          row.currency,
          fx.unitsPerUsd
        ),
        fxUnitsPerUsd: fx.unitsPerUsd,
        fxRateAt: fx.rateAt,
        fxSource: fx.source,
        paymentTermDays: row.termDays,
      },
      createdBy: user.email,
    });

    await recordAudit({
      entityType: "Contract",
      entityId: contract.id,
      action: "IMPORTED",
      actor: user,
      metadata: {
        handle: row.handle,
        code: contract.code,
        clientId: client.id,
        campaignId,
      },
    });
    created += 1;
  }

  revalidatePath("/creators");
  revalidatePath("/contratos");
  revalidatePath("/contenidos");
  revalidatePath("/campanas");

  if (created === 0) {
    return {
      ok: false,
      error: "No se ha creado ningún perfil.",
      created: 0,
      skipped: issues.length,
      issues: issues.slice(0, 20),
    };
  }

  return {
    ok: true,
    created,
    skipped: issues.length,
    issues: issues.slice(0, 20),
  };
}
