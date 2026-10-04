import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { ROSTER_IMPORT_MAX_ROWS } from "@/lib/domain/enums";
import { ROSTER_CSV_HEADER } from "@/lib/domain/roster-import";

import { CreatorImportForm } from "./import-form";
import { RosterImportForm } from "./roster-import-form";

export const metadata: Metadata = {
  title: "Importar creators",
};

export default async function ImportCreatorsPage() {
  await requirePermission("creators:write", "/creators/importar");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link href="/creators" className="hover:underline">
            Creators
          </Link>
        </p>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Alta masiva
        </h1>
        <p className="text-sm text-muted-foreground">
          Primero el roster (Instagram, país, tipo). El CSV de campaña, con
          precios, es el segundo paso.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roster desde Excel</CardTitle>
          <CardDescription>
            Hasta {ROSTER_IMPORT_MAX_ROWS} filas. Columnas típicas:{" "}
            {ROSTER_CSV_HEADER}. País y tipo tienen que existir en{" "}
            <Link href="/creators/catalogo" className="underline underline-offset-4">
              Listas
            </Link>
            ; los alias cubren «ES», «spain», etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RosterImportForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSV de campaña</CardTitle>
          <CardDescription>
            handle, email de firma, cliente, piezas, venta USD, coste, moneda,
            plazo y campaña. Si el handle ya existe, se omite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreatorImportForm />
        </CardContent>
      </Card>

      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        render={<Link href="/creators" />}
      >
        Volver a creators
      </Button>
    </main>
  );
}
