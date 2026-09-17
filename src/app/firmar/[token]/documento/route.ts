import { prisma } from "@/lib/db";
import { buildContractPdf } from "@/lib/pdf/contract-pdf";
import { loadContractPdfInput } from "@/lib/pdf/contract-pdf-input";

// El firmante no tiene cuenta: el token del enlace es su credencial.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const signatureRequest = await prisma.signatureRequest.findUnique({
    where: { token },
    select: { contractId: true },
  });

  if (!signatureRequest) {
    return new Response("Enlace no válido", { status: 404 });
  }

  const input = await loadContractPdfInput(signatureRequest.contractId);

  if (!input) {
    return new Response("Contrato no encontrado", { status: 404 });
  }

  const { bytes } = await buildContractPdf(input);

  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${input.contract.code}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
