import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

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

import { ClientForm } from "./client-form";

export const metadata: Metadata = {
  title: "Cliente",
};

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/clientes/${id}`);
  const canManage = can(user.role, "campaigns:manage");

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      _count: { select: { campaigns: true, contracts: true } },
    },
  });

  if (!client) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link href="/clientes" className="hover:underline">
            Clientes
          </Link>
        </p>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          {client.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {client._count.campaigns} campañas · {client._count.contracts}{" "}
          contratos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liquidación</CardTitle>
          <CardDescription>
            Pack o pieza, y si Finanzas tiene que subir a una plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <ClientForm client={client} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Tu rol no permite editar clientes.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
