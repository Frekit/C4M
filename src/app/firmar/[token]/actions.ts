"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { recordAudit, requestContext } from "@/lib/domain/audit";
import { CONTRACT_STATUS, SIGNATURE_STATUS } from "@/lib/domain/enums";
import { fieldErrorsFrom, signContractSchema } from "@/lib/domain/validation";
import { buildContractPdf } from "@/lib/pdf/contract-pdf";
import { loadContractPdfInput } from "@/lib/pdf/contract-pdf-input";

export type SignFormValues = {
  kind: string;
  legalName: string;
  taxId: string;
  country: string;
  addressLine: string;
  city: string;
  postalCode: string;
  region: string;
  accountHolder: string;
  payoutMethod: string;
  iban: string;
  swiftBic: string;
  bankName: string;
  wiseEmail: string;
  payoutCurrency: string;
  vatApplies: boolean;
  vatRate: string;
  withholdingApplies: boolean;
  withholdingRate: string;
  taxRegime: string;
  billingEmail: string;
  phone: string;
  contactPerson: string;
  signerFullName: string;
  acceptTerms: boolean;
};

export type SignResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: SignFormValues;
  attempt?: number;
};

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function snapshotSignForm(formData: FormData): SignFormValues {
  return {
    kind: readString(formData, "kind"),
    legalName: readString(formData, "legalName"),
    taxId: readString(formData, "taxId"),
    country: readString(formData, "country"),
    addressLine: readString(formData, "addressLine"),
    city: readString(formData, "city"),
    postalCode: readString(formData, "postalCode"),
    region: readString(formData, "region"),
    accountHolder: readString(formData, "accountHolder"),
    payoutMethod: readString(formData, "payoutMethod"),
    iban: readString(formData, "iban"),
    swiftBic: readString(formData, "swiftBic"),
    bankName: readString(formData, "bankName"),
    wiseEmail: readString(formData, "wiseEmail"),
    payoutCurrency: readString(formData, "payoutCurrency"),
    vatApplies: formData.get("vatApplies") === "on",
    vatRate: readString(formData, "vatRate"),
    withholdingApplies: formData.get("withholdingApplies") === "on",
    withholdingRate: readString(formData, "withholdingRate"),
    taxRegime: readString(formData, "taxRegime"),
    billingEmail: readString(formData, "billingEmail"),
    phone: readString(formData, "phone"),
    contactPerson: readString(formData, "contactPerson"),
    signerFullName: readString(formData, "signerFullName"),
    acceptTerms: formData.get("acceptTerms") === "on",
  };
}

function fail(
  prev: SignResult | null,
  formData: FormData,
  extras: Pick<SignResult, "error" | "fieldErrors">
): SignResult {
  return {
    ok: false,
    ...extras,
    values: snapshotSignForm(formData),
    attempt: (prev?.attempt ?? 0) + 1,
  };
}

function parseRate(value: string | undefined | null): number | null {
  if (!value) return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

export async function signContract(
  _prev: SignResult | null,
  formData: FormData
): Promise<SignResult> {
  const token = String(formData.get("token") ?? "");

  const request = await prisma.signatureRequest.findUnique({
    where: { token },
    include: { contract: { include: { creator: true } } },
  });

  if (!request) {
    return fail(_prev, formData, {
      error: "Este enlace de firma no existe.",
    });
  }

  if (request.status === SIGNATURE_STATUS.SIGNED) {
    return fail(_prev, formData, {
      error: "Este contrato ya estaba firmado.",
    });
  }

  if (
    request.status === SIGNATURE_STATUS.REVOKED ||
    request.expiresAt < new Date() ||
    request.contract.status === CONTRACT_STATUS.CANCELLED
  ) {
    return fail(_prev, formData, {
      error: "Este enlace ya no es válido. Pide uno nuevo.",
    });
  }

  const values = snapshotSignForm(formData);
  const parsed = signContractSchema.safeParse({
    ...values,
    acceptTerms: values.acceptTerms ? "on" : "",
  });

  if (!parsed.success) {
    return fail(_prev, formData, {
      fieldErrors: fieldErrorsFrom(parsed.error),
    });
  }

  const data = parsed.data;

  if (data.payoutMethod === "WISE" && !data.wiseEmail) {
    return fail(_prev, formData, {
      fieldErrors: { wiseEmail: "Necesitamos el email de la cuenta de Wise" },
    });
  }

  if (data.payoutMethod === "BANK_TRANSFER" && !data.iban) {
    return fail(_prev, formData, {
      fieldErrors: { iban: "Necesitamos el IBAN o número de cuenta" },
    });
  }

  const accountHolder = data.accountHolder || data.legalName;

  const context = await requestContext();
  const signedAt = new Date();

  const payee = await prisma.payeeProfile.create({
    data: {
      creatorId: request.contract.creatorId,
      kind: data.kind,
      legalName: data.legalName,
      taxId: data.taxId,
      country: data.country,
      addressLine: data.addressLine,
      city: data.city,
      postalCode: data.postalCode,
      region: data.region || null,
      accountHolder,
      payoutMethod: data.payoutMethod,
      iban: data.iban || null,
      swiftBic: data.swiftBic || null,
      bankName: data.bankName || null,
      wiseEmail: data.wiseEmail || null,
      payoutCurrency: data.payoutCurrency,
      vatApplies: Boolean(data.vatApplies),
      vatRate: data.vatApplies ? parseRate(data.vatRate) : null,
      withholdingApplies: Boolean(data.withholdingApplies),
      withholdingRate: data.withholdingApplies
        ? parseRate(data.withholdingRate)
        : null,
      taxRegime: data.taxRegime || null,
      billingEmail: data.billingEmail,
      phone: data.phone || null,
      contactPerson: data.contactPerson || null,
    },
  });

  await prisma.signatureRequest.update({
    where: { id: request.id },
    data: {
      status: SIGNATURE_STATUS.SIGNED,
      signedAt,
      signerFullName: data.signerFullName,
      signerIp: context.ip,
      signerUserAgent: context.userAgent,
      payeeProfileId: payee.id,
    },
  });

  await prisma.contract.update({
    where: { id: request.contractId },
    data: {
      status: CONTRACT_STATUS.SIGNED,
      signedAt,
      startsAt: request.contract.startsAt ?? signedAt,
    },
  });

  // El PDF se genera después de firmar para que incluya el rastro, y se guarda
  // su huella para poder verificar que no se ha alterado.
  const pdfInput = await loadContractPdfInput(request.contractId);

  if (pdfInput) {
    const { sha256, bytes } = await buildContractPdf(pdfInput);
    await prisma.signatureRequest.update({
      where: { id: request.id },
      data: {
        documentSha256: sha256,
        documentPdf: Buffer.from(bytes),
      },
    });
  }

  await recordAudit({
    entityType: "Contract",
    entityId: request.contractId,
    action: "SIGNED",
    actorEmail: request.recipientEmail,
    metadata: {
      signerFullName: data.signerFullName,
      payeeProfileId: payee.id,
      contractCode: request.contract.code,
    },
  });

  // Al firmar cambia el estado que se ve en el panel, en el listado y en la
  // ficha del creator, así que hay que invalidar todas esas rutas.
  revalidatePath("/");
  revalidatePath("/contratos");
  revalidatePath("/contenidos");
  revalidatePath(`/contratos/${request.contractId}`);
  revalidatePath(`/creators/${request.contract.creatorId}`);
  revalidatePath(`/creators`);
  redirect(`/firmar/${token}`);
}
