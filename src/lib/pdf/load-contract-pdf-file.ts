import { prisma } from "@/lib/db";
import { SIGNATURE_STATUS } from "@/lib/domain/enums";
import { buildContractPdf } from "@/lib/pdf/contract-pdf";
import { loadContractPdfInput } from "@/lib/pdf/contract-pdf-input";

export async function loadContractPdfFile(contractId: string): Promise<{
  bytes: Uint8Array;
  filename: string;
} | null> {
  const stored = await prisma.signatureRequest.findFirst({
    where: {
      contractId,
      status: SIGNATURE_STATUS.SIGNED,
      documentPdf: { not: null },
    },
    orderBy: { signedAt: "desc" },
    select: {
      documentPdf: true,
      contract: { select: { code: true } },
    },
  });

  if (stored?.documentPdf) {
    return {
      bytes: stored.documentPdf,
      filename: `${stored.contract.code}.pdf`,
    };
  }

  const input = await loadContractPdfInput(contractId);
  if (!input) return null;

  const { bytes } = await buildContractPdf(input);
  return { bytes, filename: `${input.contract.code}.pdf` };
}
