"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { recordAudit, requestContext } from "@/lib/domain/audit";
import { CONTRACT_STATUS, SIGNATURE_STATUS } from "@/lib/domain/enums";
import { fieldErrorsFrom, signContractSchema } from "@/lib/domain/validation";
import { buildContractPdf } from "@/lib/pdf/contract-pdf";
import { loadContractPdfInput } from "@/lib/pdf/contract-pdf-input";

export type SignResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

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
    return { ok: false, error: "Este enlace de firma no existe." };
  }

  if (request.status === SIGNATURE_STATUS.SIGNED) {
    return { ok: false, error: "Este contrato ya estaba firmado." };
  }

  if (
    request.status === SIGNATURE_STATUS.REVOKED ||
    request.expiresAt < new Date() ||
    request.contract.status === CONTRACT_STATUS.CANCELLED
  ) {
    return { ok: false, error: "Este enlace ya no es válido. Pide uno nuevo." };
  }

  const parsed = signContractSchema.safeParse({
    kind: formData.get("kind"),
    legalName: formData.get("legalName"),
    taxId: formData.get("taxId"),
    country: formData.get("country"),
    addressLine: formData.get("addressLine"),
    city: formData.get("city"),
    postalCode: formData.get("postalCode"),
    region: formData.get("region"),
    accountHolder: formData.get("accountHolder"),
    payoutMethod: formData.get("payoutMethod"),
    iban: formData.get("iban"),
    swiftBic: formData.get("swiftBic"),
    bankName: formData.get("bankName"),
    wiseEmail: formData.get("wiseEmail"),
    payoutCurrency: formData.get("payoutCurrency"),
    vatApplies: formData.get("vatApplies") ?? false,
    vatRate: formData.get("vatRate"),
    withholdingApplies: formData.get("withholdingApplies") ?? false,
    withholdingRate: formData.get("withholdingRate"),
    taxRegime: formData.get("taxRegime"),
    billingEmail: formData.get("billingEmail"),
    phone: formData.get("phone"),
    contactPerson: formData.get("contactPerson"),
    signerFullName: formData.get("signerFullName"),
    acceptTerms: formData.get("acceptTerms"),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const data = parsed.data;

  // Sin datos de cobro completos no se puede pagar después, así que aquí se
  // exige lo que corresponda al método elegido.
  if (data.payoutMethod === "BANK_TRANSFER" && !data.iban) {
    return { ok: false, fieldErrors: { iban: "Necesitamos el IBAN o número de cuenta" } };
  }

  if (data.payoutMethod === "WISE" && !data.wiseEmail) {
    return {
      ok: false,
      fieldErrors: { wiseEmail: "Necesitamos el email de la cuenta de Wise" },
    };
  }

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
      accountHolder: data.accountHolder,
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
    const { sha256 } = await buildContractPdf(pdfInput);
    await prisma.signatureRequest.update({
      where: { id: request.id },
      data: { documentSha256: sha256 },
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
