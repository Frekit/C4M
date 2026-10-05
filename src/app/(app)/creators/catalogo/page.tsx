import Link from "next/link";
import type { Metadata } from "next";

import { archiveRosterOption } from "@/app/(app)/creators/catalog-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import {
  loadRosterCatalogAdmin,
  type RosterCatalogOption,
  type RosterOptionKind,
} from "@/lib/domain/roster-catalog";

import { AddAliasesForm, AddCatalogOptionForm } from "./option-forms";

export const metadata: Metadata = {
  title: "Listas del roster",
};

function OptionList({
  title,
  description,
  noun,
  kind,
  options,
}: {
  title: string;
  description: string;
  noun: string;
  kind: RosterOptionKind;
  options: RosterCatalogOption[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        <AddCatalogOptionForm kind={kind} noun={noun} />
        <ul className="grid gap-3">
          {options.map((option) => (
            <li key={option.id} className="grid gap-2 rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {option.aliases.length > 0
                      ? `Alias: ${option.aliases.join(", ")}`
                      : "Sin alias. El Excel solo entra si pone exactamente este nombre."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {option.archived ? (
                    <Badge variant="secondary">Archivado</Badge>
                  ) : null}
                  <form action={archiveRosterOption}>
                    <input type="hidden" name="optionId" value={option.id} />
                    <input
                      type="hidden"
                      name="archived"
                      value={option.archived ? "0" : "1"}
                    />
                    <Button type="submit" size="sm" variant="ghost">
                      {option.archived ? "Restaurar" : "Archivar"}
                    </Button>
                  </form>
                </div>
              </div>
              {!option.archived ? <AddAliasesForm optionId={option.id} /> : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default async function RosterCatalogPage() {
  await requirePermission("creators:write", "/creators/catalogo");
  const catalog = await loadRosterCatalogAdmin();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">
          <Link href="/creators" className="hover:underline">
            Creators
          </Link>
        </p>
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Listas cerradas
        </h1>
        <p className="text-sm text-muted-foreground">
          País y tipo no se escriben a mano. Si en el Excel pone «spain» o
          «ES», añade un alias a España. Si falta un valor, créalo aquí antes
          de importar.
        </p>
      </div>

      <OptionList
        title="Países"
        description="Un país, un valor. Los alias cubren cómo lo escriben en cada Excel."
        noun="País"
        kind="COUNTRY"
        options={catalog.countries}
      />
      <OptionList
        title="Tipos de perfil"
        description="UGC, Micro, Tech… lo que uséis. El formulario solo deja elegir de esta lista."
        noun="Tipo"
        kind="PROFILE_TYPE"
        options={catalog.profileTypes}
      />
    </main>
  );
}
