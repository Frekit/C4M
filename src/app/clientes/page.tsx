import Link from "next/link";
import type { Metadata } from "next";
import { Building2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  SETTLEMENT_MODE,
  SETTLEMENT_MODE_LABELS,
  type SettlementMode,
} from "@/lib/domain/enums";

export const metadata: Metadata = {
  title: "Clientes",
};

export default async function ClientsPage() {
  const user = await requireUser("/clientes");
  const canManage = can(user.role, "campaigns:manage");

  const clients = await prisma.client.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { campaigns: true, contracts: true } },
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Clientes
        </h1>
        <p className="text-sm text-muted-foreground">
          Higgsfield se liquida pieza a pieza y pide plataforma. Many Chat, al
          cerrar el pack. Si te equivocas al crearlos, se edita aquí.
        </p>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardHeader>
            <Building2Icon className="size-5 text-muted-foreground" />
            <CardTitle>Todavía no hay clientes</CardTitle>
            <CardDescription>
              Nacen al crear una campaña o un contrato. Luego vuelves aquí a
              cambiar pack vs pieza.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>{client.name}</CardTitle>
                    <CardDescription>
                      {client._count.campaigns} campañas ·{" "}
                      {client._count.contracts} contratos
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={<Link href={`/clientes/${client.id}`} />}
                  >
                    {canManage ? "Editar" : "Ver"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {
                    SETTLEMENT_MODE_LABELS[
                      client.settlementMode as SettlementMode
                    ]
                  }
                </Badge>
                <Badge variant="secondary">
                  {client.requiresPlatformSubmit
                    ? "Plataforma"
                    : "Sin plataforma"}
                </Badge>
                {client.settlementMode === SETTLEMENT_MODE.PACK ? (
                  <Badge>Pack</Badge>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
