import { z } from "zod";

import { isSupportedCurrency } from "@/lib/currencies";
import {
  PAYEE_KIND,
  PAYOUT_METHOD,
  RECIPIENT_KIND,
  ROLES,
} from "@/lib/domain/enums";

// Acepta el enlace completo, con o sin www, o directamente el handle.
export function extractInstagramHandle(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  const fromUrl = value.match(
    /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?/i
  );
  const candidate = fromUrl ? fromUrl[1] : value.replace(/^@/, "");

  if (!/^[A-Za-z0-9._]{1,30}$/.test(candidate)) {
    return null;
  }

  return candidate.toLowerCase();
}

export function instagramUrlFor(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}

// FormData.get() devuelve null si el control no está en el DOM: casilla
// desmarcada, bloque de Wise/IVA oculto, etc. Zod 4 lo convierte en
// «Invalid input» y React 19, al fallar la acción, resetea el formulario.
function fromFormString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function fromFormFlag(value: unknown): boolean {
  return value === true || value === "on" || value === "true";
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

const amountString = z
  .string()
  .trim()
  .min(1, "Obligatorio")
  .refine(
    (value) => /^\d+([.,]\d{1,3})?$/.test(value.replace(/\s/g, "")),
    "Escribe un número, con punto o coma para los decimales"
  );

const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isSupportedCurrency, "Moneda no soportada");

export const createCreatorContractSchema = z.object({
  instagram: z
    .string()
    .trim()
    .min(1, "Pon el enlace de Instagram o el handle")
    .refine((value) => extractInstagramHandle(value) !== null, "Enlace no válido"),
  displayName: z.string().trim().max(120).optional().or(z.literal("")),
  contactEmail: z
    .string()
    .trim()
    .email("Email no válido")
    .optional()
    .or(z.literal("")),
  deliverableCount: z.coerce
    .number()
    .int("Tiene que ser un número entero")
    .min(1, "Al menos un contenido")
    .max(365, "Demasiados contenidos para un solo contrato"),
  salePricePerContent: amountString,
  costCurrency: currencyCode,
  costPerContent: amountString,
  fxUnitsPerUsd: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? Number(value.replace(",", ".")) : null))
    .refine(
      (value) => value === null || (Number.isFinite(value) && value > 0),
      "El tipo de cambio tiene que ser mayor que cero"
    ),
  paymentTermDays: z.coerce
    .number()
    .int()
    .min(0, "No puede ser negativo")
    .max(365, "Máximo 365 días"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const renewalSchema = z.object({
  mode: z.enum(["ANNEX", "RENEWAL"]),
  deliverableCount: z.coerce.number().int().min(1).max(365),
  salePricePerContent: amountString,
  costCurrency: currencyCode,
  costPerContent: amountString,
  fxUnitsPerUsd: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value) => (value ? Number(value.replace(",", ".")) : null))
    .refine(
      (value) => value === null || (Number.isFinite(value) && value > 0),
      "El tipo de cambio tiene que ser mayor que cero"
    ),
  paymentTermDays: z.coerce.number().int().min(0).max(365),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
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

  accountHolder: requiredText(2, 200),
  payoutMethod: z.enum([PAYOUT_METHOD.BANK_TRANSFER, PAYOUT_METHOD.WISE], {
    error: "Elige cómo quieres cobrar",
  }),
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
