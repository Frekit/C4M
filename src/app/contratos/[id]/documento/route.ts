import { getCurrentUser } from "@/lib/auth/session";
import { loadContractPdfFile } from "@/lib/pdf/load-contract-pdf-file";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();

  if (!user) {
    return new Response("No autorizado", { status: 401 });
  }

  const { id } = await params;
  const file = await loadContractPdfFile(id);

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
