import { z } from "zod";

import { isSupportedCurrency } from "@/lib/currencies";
import { parseBudgetUsd } from "@/lib/domain/campaign-desk";
import {
  CAMPAIGN_APPROVAL,
  CAMPAIGN_ENGAGEMENT,
  PAYEE_KIND,
  PAYOUT_METHOD,
  RECIPIENT_KIND,
  ROLES,
  SETTLEMENT_MODE,
} from "@/lib/domain/enums";
import { extractInstagramHandle } from "@/lib/domain/instagram-handle";

export { extractInstagramHandle };

export function instagramUrlFor(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}

// FormData.get() devuelve null si el control no está en el DOM: casilla
// desmarcada, bloque de Wise/IVA oculto, etc. Zod 4 lo convierte en
// «Invalid input» y React 19, al fallar la acción, resetea el formulario.
function fromFormString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function fromFormFlag(value: unknown): boolean {
  return value === true || value === "on" || value === "true" || value === "1";
}

const formString = z.unknown().transform(fromFormString);

const requiredText = (min: number, max: number, message = "Obligatorio") =>
  formString.pipe(z.string().trim().min(min, message).max(max));

const optionalText = (max: number) =>
  formString.pipe(z.string().trim().max(max));

const requiredEmail = formString.pipe(
  z.string().trim().email("Email no válido")
);

const optionalEmail = formString.pipe(
  z
    .string()
    .trim()
    .pipe(z.union([z.literal(""), z.string().email("Email no válido")]))
);

const formFlag = z.unknown().transform(fromFormFlag);

const amountString = formString.pipe(
  z
    .string()
    .trim()
    .min(1, "Obligatorio")
    .refine(
      (value) => /^\d+([.,]\d{1,3})?$/.test(value.replace(/\s/g, "")),
      "Escribe un número, con punto o coma para los decimales"
    )
);

const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isSupportedCurrency, "Moneda no soportada");

const formCurrency = formString.pipe(currencyCode);

function formIntInRange(
  min: number,
  max: number,
  messages: { empty: string; int: string; min: string; max: string }
) {
  return formString.pipe(
    z.string().transform((raw, ctx) => {
      const text = raw.trim();
      if (text === "") {
        ctx.addIssue({ code: "custom", message: messages.empty });
        return z.NEVER;
      }
      if (!/^-?\d+$/.test(text)) {
        ctx.addIssue({ code: "custom", message: messages.int });
        return z.NEVER;
      }
      const value = Number(text);
      if (value < min) {
        ctx.addIssue({ code: "custom", message: messages.min });
        return z.NEVER;
      }
      if (value > max) {
        ctx.addIssue({ code: "custom", message: messages.max });
        return z.NEVER;
      }
      return value;
    })
  );
}

const formCount = formIntInRange(1, 365, {
  empty: "Al menos un contenido",
  int: "Tiene que ser un número entero",
  min: "Al menos un contenido",
  max: "Demasiados contenidos para un solo contrato",
});

const formPaymentTerm = formIntInRange(0, 365, {
  empty: "Tiene que ser un número entero",
  int: "Tiene que ser un número entero",
  min: "No puede ser negativo",
  max: "Máximo 365 días",
});

const formClientId = formString.pipe(
  z.string().trim().min(1, "Elige el cliente")
);

// Vacío, ausente (USD oculta el input) o un número ya parseado = usar
// ese valor, o el cambio guardado si no hay ninguno.
export const optionalFxRate = z.unknown().transform((raw, ctx) => {
  const text =
    typeof raw === "number" && Number.isFinite(raw)
      ? String(raw)
      : typeof raw === "string"
        ? raw.trim()
        : "";

  if (text === "") return null;

  const parsed = Number(text.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    ctx.addIssue({
      code: "custom",
      message: "El tipo de cambio tiene que ser mayor que cero",
    });
    return z.NEVER;
  }

  return parsed;
});

export const fxRateFormSchema = z.object({
  currency: formCurrency,
  unitsPerUsd: z.unknown().transform((raw, ctx) => {
    const text =
      typeof raw === "number" && Number.isFinite(raw)
        ? String(raw)
        : typeof raw === "string"
          ? raw.trim()
          : "";

    if (text === "") {
      ctx.addIssue({
        code: "custom",
        message: "Escribe el tipo de cambio",
      });
      return z.NEVER;
    }

    const parsed = Number(text.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "El tipo de cambio tiene que ser mayor que cero",
      });
      return z.NEVER;
    }

    return parsed;
  }),
});

export const createCreatorContractSchema = z.object({
  instagram: formString.pipe(
    z
      .string()
      .trim()
      .min(1, "Pon el enlace de Instagram o el handle")
      .refine(
        (value) => extractInstagramHandle(value) !== null,
        "Enlace no válido"
      )
  ),
  displayName: optionalText(120),
  contactEmail: optionalEmail,
  deliverableCount: formCount,
  salePricePerContent: amountString,
  costCurrency: formCurrency,
  costPerContent: amountString,
  fxUnitsPerUsd: optionalFxRate,
  paymentTermDays: formPaymentTerm,
  notes: optionalText(8000),
  clientId: formClientId,
  campaignId: optionalText(80),
});

export const newClientContractSchema = z.object({
  creatorId: formString.pipe(z.string().min(1, "Falta el creator")),
  clientId: formClientId,
  campaignId: optionalText(80),
  deliverableCount: formCount,
  salePricePerContent: amountString,
  costCurrency: formCurrency,
  costPerContent: amountString,
  fxUnitsPerUsd: optionalFxRate,
  paymentTermDays: formPaymentTerm,
  notes: optionalText(8000),
});

export const renewalSchema = z.object({
  mode: formString.pipe(
    z.enum(["ANNEX", "RENEWAL"], {
      error: "Elige anexo o renovación",
    })
  ),
  deliverableCount: formCount,
  salePricePerContent: amountString,
  costCurrency: formCurrency,
  costPerContent: amountString,
  fxUnitsPerUsd: optionalFxRate,
  paymentTermDays: formPaymentTerm,
  notes: optionalText(8000),
  campaignId: optionalText(80),
});

export const sendSignatureSchema = z.object({
  contractId: z.string().min(1),
  recipientEmail: z.string().trim().email("Email no válido"),
  recipientKind: z.enum([RECIPIENT_KIND.TALENT, RECIPIENT_KIND.AGENCY]),
  expiresInDays: z.coerce.number().int().min(1).max(90).default(14),
});

export const signContractSchema = z.object({
  kind: z.enum([PAYEE_KIND.INDIVIDUAL, PAYEE_KIND.COMPANY, PAYEE_KIND.AGENCY], {
    error: "Elige si firmas como persona, empresa o agencia",
  }),

  legalName: requiredText(2, 200),
  taxId: requiredText(4, 40),
  country: requiredText(2, 60),
  addressLine: requiredText(4, 200),
  city: requiredText(2, 80),
  postalCode: requiredText(3, 20),
  region: optionalText(80),

  accountHolder: optionalText(200),
  payoutMethod: formString.pipe(
    z
      .enum([
        PAYOUT_METHOD.ZEXEL,
        PAYOUT_METHOD.BANK_TRANSFER,
        PAYOUT_METHOD.WISE,
      ])
      .or(z.literal(""))
      .transform((value) => value || PAYOUT_METHOD.ZEXEL)
  ),
  iban: optionalText(60),
  swiftBic: optionalText(20),
  bankName: optionalText(120),
  wiseEmail: optionalEmail,
  payoutCurrency: formString.pipe(currencyCode),

  vatApplies: formFlag,
  vatRate: optionalText(10),
  withholdingApplies: formFlag,
  withholdingRate: optionalText(10),
  taxRegime: optionalText(120),

  billingEmail: requiredEmail,
  phone: optionalText(40),
  contactPerson: optionalText(120),

  signerFullName: requiredText(3, 200, "Escribe tu nombre completo"),
  acceptTerms: z
    .unknown()
    .transform((value) => (fromFormFlag(value) ? "on" : ""))
    .pipe(
      z.literal("on", {
        error: "Tienes que aceptar el contrato para firmar",
      })
    ),
});

const optionalDate = formString.pipe(
  z
    .string()
    .trim()
    .transform((value) =>
      value ? new Date(`${value}T00:00:00.000Z`) : null
    )
    .refine(
      (value) => value === null || !Number.isNaN(value.getTime()),
      "Fecha no válida"
    )
);

export const campaignSchema = z.object({
  name: requiredText(2, 120, "Ponle un nombre"),
  clientId: optionalText(80),
  newClientName: optionalText(120),
  newSettlementMode: z.unknown().transform((raw, ctx) => {
    const value = fromFormString(raw).trim();
    if (value === "") return undefined;
    if (
      value === SETTLEMENT_MODE.PER_CONTENT ||
      value === SETTLEMENT_MODE.PACK
    ) {
      return value;
    }
    ctx.addIssue({
      code: "custom",
      message: "Elige cómo se liquida",
    });
    return z.NEVER;
  }),
  newRequiresPlatformSubmit: formFlag,
  description: optionalText(1000),
  startsAt: optionalDate,
  endsAt: optionalDate,
  engagementKind: z.unknown().optional().transform((raw, ctx) => {
    const value = fromFormString(raw).trim();
    if (value === "") return CAMPAIGN_ENGAGEMENT.ALWAYS_ON;
    if (
      value === CAMPAIGN_ENGAGEMENT.SLATE ||
      value === CAMPAIGN_ENGAGEMENT.BUDGET ||
      value === CAMPAIGN_ENGAGEMENT.ALWAYS_ON
    ) {
      return value;
    }
    ctx.addIssue({ code: "custom", message: "Elige cómo es el encargo" });
    return z.NEVER;
  }),
  approvalMode: z.unknown().optional().transform((raw, ctx) => {
    const value = fromFormString(raw).trim();
    if (value === "") return CAMPAIGN_APPROVAL.INTERNAL;
    if (
      value === CAMPAIGN_APPROVAL.INTERNAL ||
      value === CAMPAIGN_APPROVAL.CLIENT_APPROVES
    ) {
      return value;
    }
    ctx.addIssue({ code: "custom", message: "Elige si el cliente aprueba" });
    return z.NEVER;
  }),
  budgetUsd: z.unknown().optional().transform(fromFormString).pipe(z.string().trim().max(20)),
  defaultPaymentTermDays: z
    .unknown()
    .optional()
    .transform(fromFormString)
    .pipe(z.string().trim().max(8)),
}).superRefine((data, ctx) => {
  if (data.engagementKind !== CAMPAIGN_ENGAGEMENT.BUDGET) return;
  if (parseBudgetUsd(data.budgetUsd) == null) {
    ctx.addIssue({
      code: "custom",
      path: ["budgetUsd"],
      message: "Pon el presupuesto en USD.",
    });
  }
});

export const clientUpdateSchema = z.object({
  clientId: formString.pipe(z.string().min(1)),
  name: requiredText(2, 120, "Ponle un nombre"),
  settlementMode: formString.pipe(
    z.enum([SETTLEMENT_MODE.PER_CONTENT, SETTLEMENT_MODE.PACK], {
      error: "Elige cómo se liquida",
    })
  ),
  requiresPlatformSubmit: formFlag,
  notes: optionalText(1000),
});

export const contractParticularsSchema = z.object({
  contractId: formString.pipe(z.string().min(1)),
  notes: optionalText(8000),
});

export const conditionsAnnexSchema = z.object({
  parentId: formString.pipe(z.string().min(1)),
  notes: requiredText(
    20,
    8000,
    "Escribe las condiciones pactadas con este talento"
  ),
});

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email no válido"),
  role: z.enum([ROLES.ADMIN, ROLES.CREATORS, ROLES.ACCOUNTING, ROLES.VIEWER]),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(2, "Escribe tu nombre").max(120),
});

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!result[key]) {
      result[key] =
        issue.message === "Invalid input" ||
        issue.message.startsWith("Invalid input:")
          ? "Revisa este dato"
          : issue.message;
    }
  }

  return result;
}
