import type { Metadata } from "next";

import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateTimeUtc } from "@/lib/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Auditoría",
};

const ACTION_LABELS: Record<string, string> = {
  SIGNATURE_SENT: "Enviado a firma",
  SIGNATURE_REVOKED: "Enlace de firma revocado",
  SIGNED: "Firmado",
  PARTICULARS_UPDATED: "Particulares actualizadas",
  CONDITIONS_ANNEX_CREATED: "Anexo de condiciones",
  ANNEX_CREATED: "Anexo de contenidos",
  RENEWAL_CREATED: "Renovación",
  CREATED: "Contrato creado",
  CANCELLED: "Cancelado",
  DELETED: "Borrado",
  INVITED: "Invitación",
  REVOKED: "Invitación revocada",
  ROLE_CHANGED: "Cambio de rol",
  ENABLED: "Cuenta activada",
  DISABLED: "Cuenta desactivada",
  FX_UPDATED: "Tipo de cambio",
  SUBMITTED: "Subido a plataforma",
  PLATFORM_SUBMIT_ERROR: "Error al subir a plataforma",
  PLATFORM_SUBMIT_RETRY: "Reintento de subida",
  MARKED_PAID: "Lote marcado como pagado",
};

export default async function AuditPage() {
  await requireUser("/auditoria");

  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Auditoría
        </h1>
        <p className="text-sm text-muted-foreground">
          Quién hizo qué: firmas, contenidos de finanzas y cambios de equipo.
          Los últimos 80 eventos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eventos</CardTitle>
          <CardDescription>
            Sin datos bancarios. Sirve para reconstruir una disputa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay rastro.</p>
          ) : (
            <ol className="grid gap-2">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="grid gap-1 rounded-lg border px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {ACTION_LABELS[event.action] ?? event.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTimeUtc(event.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {event.actorEmail ?? "sin actor"}
                    {event.actorRole ? ` · ${event.actorRole}` : ""}
                    {" · "}
                    {event.entityType} {event.entityId}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
