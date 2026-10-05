import { PageShell, PageHeader } from "@/components/page-shell";
import { ApprovalCard, type ApprovalItem } from "@/components/approval-card";
import { requireUser } from "@/lib/auth/session";

const STATES: ApprovalItem[] = [
  { id: "pendiente", title: "Cambiar estado", detail: "Propuesto → Aprobado", state: "pendiente" },
  { id: "aceptado", title: "Cambiar estado", detail: "Aceptado, aún sin aplicar", state: "aceptado" },
  { id: "aplicando", title: "Crear contrato", detail: "Se está aplicando en local", state: "aplicando" },
  { id: "hecho", title: "Crear contrato", detail: "Hecho en la simulación", state: "hecho" },
  { id: "descartado", title: "Crear contrato", detail: "Lo has descartado", state: "descartado" },
  {
    id: "aviso",
    title: "Crear contrato",
    detail: "Falta un dato",
    state: "aviso",
    warning: "No tiene email de contacto.",
  },
  { id: "error", title: "Preparar lote", detail: "No se pudo simular", state: "error" },
];

export default async function DevAiPage() {
  await requireUser("/dev/ia");
  return (
    <PageShell width="narrow">
      <PageHeader
        title="Estados del asistente"
        description="Galería local de la tarjeta de aprobación. No llama a ningún modelo ni escribe en la base de datos."
      />
      <ApprovalCard title="Todos los estados" items={STATES} />
    </PageShell>
  );
}
