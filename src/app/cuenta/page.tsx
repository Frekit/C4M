import type { Metadata } from "next";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { permissionsFor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getLogoutHref } from "@/lib/auth/urls";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/domain/enums";

export const metadata: Metadata = {
  title: "Mi cuenta",
};

const PERMISSION_LABELS: Record<string, string> = {
  "creators:write": "Registrar y editar creators",
  "contracts:write": "Crear contratos",
  "contracts:cancel": "Cancelar contratos",
  "contracts:renew": "Ampliar y renovar",
  "signature:send": "Enviar contratos a firma",
  "deliverables:publish": "Marcar contenidos publicados",
  "payees:read_full": "Ver datos bancarios completos",
  "team:manage": "Gestionar el equipo",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function AccountPage() {
  const user = await requireUser("/cuenta");
  const permissions = permissionsFor(user.role);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="font-heading text-2xl font-medium tracking-tight">
        Mi cuenta
      </h1>

      <Card>
        <CardHeader className="flex-row items-start gap-4">
          <Avatar size="lg">
            {user.picture ? <AvatarImage src={user.picture} alt="" /> : null}
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <CardTitle>{user.name}</CardTitle>
            <CardDescription>{user.email}</CardDescription>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline">{ROLE_LABELS[user.role]}</Badge>
              <Badge variant="secondary">
                {user.provider === "auth0" ? "Auth0" : "Sesión local"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Separator />
          <div>
            <p className="text-sm font-medium">Qué puedes hacer</p>
            <p className="text-xs text-muted-foreground">
              {ROLE_DESCRIPTIONS[user.role]}
            </p>
          </div>

          {permissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Acceso de solo lectura.
            </p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {permissions.map((permission) => (
                <li key={permission} className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-foreground/40"
                  />
                  {PERMISSION_LABELS[permission] ?? permission}
                </li>
              ))}
            </ul>
          )}

          <Button
            variant="outline"
            className="w-fit"
            nativeButton={false}
            render={<a href={getLogoutHref()} />}
          >
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
