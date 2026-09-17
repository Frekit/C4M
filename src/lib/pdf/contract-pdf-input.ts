import { prisma } from "@/lib/db";
import { SIGNATURE_STATUS } from "@/lib/domain/enums";

import type { ContractPdfInput } from "./contract-pdf";

// Reúne todo lo que necesita el PDF. El documento se genera siempre desde estos
// datos, así que puede regenerarse y su hash sigue coincidiendo.
export async function loadContractPdfInput(
  contractId: string
): Promise<ContractPdfInput | null> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      creator: true,
      parent: true,
      signatureRequests: {
        orderBy: { createdAt: "desc" },
        include: { payee: true },
      },
    },
  });

  if (!contract) return null;

  const signed = contract.signatureRequests.find(
    (request) => request.status === SIGNATURE_STATUS.SIGNED
  );

  return {
    contract: {
      code: contract.code,
      kind: contract.kind,
      deliverableCount: contract.deliverableCount,
      costCurrency: contract.costCurrency,
      costMinorPerContent: contract.costMinorPerContent,
      salePriceCentsPerContent: contract.salePriceCentsPerContent,
      paymentTermDays: contract.paymentTermDays,
      notes: contract.notes,
      createdAt: contract.createdAt,
      signedAt: contract.signedAt,
    },
    parentCode: contract.parent?.code ?? null,
    creator: {
      handle: contract.creator.handle,
      instagramUrl: contract.creator.instagramUrl,
      displayName: contract.creator.displayName,
    },
    signature: signed
      ? {
          signerFullName: signed.signerFullName,
          signedAt: signed.signedAt,
          signerIp: signed.signerIp,
          recipientEmail: signed.recipientEmail,
        }
      : null,
    payee: signed?.payee
      ? {
          legalName: signed.payee.legalName,
          taxId: signed.payee.taxId,
          country: signed.payee.country,
          addressLine: signed.payee.addressLine,
          city: signed.payee.city,
          postalCode: signed.payee.postalCode,
          billingEmail: signed.payee.billingEmail,
          payoutCurrency: signed.payee.payoutCurrency,
          payoutMethod: signed.payee.payoutMethod,
          iban: signed.payee.iban,
          wiseEmail: signed.payee.wiseEmail,
          accountHolder: signed.payee.accountHolder,
        }
      : null,
  };
}
