import { getCurrentUser } from "@/lib/auth/session";
import { buildContractPdf } from "@/lib/pdf/contract-pdf";
import { loadContractPdfInput } from "@/lib/pdf/contract-pdf-input";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("No autorizado", { status: 401 });
  }

  const { id } = await params;
  const input = await loadContractPdfInput(id);

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
