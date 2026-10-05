import { prisma } from "@/lib/db";
import { loadContractPdfFile } from "@/lib/pdf/load-contract-pdf-file";

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

  const file = await loadContractPdfFile(signatureRequest.contractId);

  if (!file) {
    return new Response("Contrato no encontrado", { status: 404 });
  }

  return new Response(file.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
