import Link from "next/link";
import { LogOutIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { can } from "@/lib/auth/permissions";
import type { AppUser } from "@/lib/auth/types";
import { getLogoutHref } from "@/lib/auth/urls";
import { ROLE_LABELS } from "@/lib/domain/enums";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppNav({ user }: { user: AppUser | null }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          className="font-heading shrink-0 text-sm font-medium tracking-tight"
        >
          Creators<span className="text-muted-foreground">/Contratos</span>
        </Link>

        {user ? (
          <nav className="-mx-1 flex flex-1 items-center gap-0.5 overflow-x-auto px-1">
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/" />}>
              Panel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/creators" />}
            >
              Creators
            </Button>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/contratos" />}
            >
              Contratos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/contenidos" />}
            >
              Contenidos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/campanas" />}
            >
              Campañas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/flujo" />}
            >
              Flujo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href="/clientes" />}
            >
              Clientes
            </Button>
            {can(user.role, "finance:manage") ? (
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/finanzas" />}
              >
                Finanzas
              </Button>
            ) : null}
            {can(user.role, "team:manage") ? (
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/equipo" />}
              >
                Equipo
              </Button>
            ) : null}
          </nav>
        ) : (
          <div className="flex-1" />
        )}

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm">
                  <span className="hidden sm:inline">{user.name}</span>
                  <span className="sm:hidden">{initials(user.name)}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuLabel className="grid gap-1">
                <span className="truncate text-sm font-medium">{user.email}</span>
                <Badge variant="outline" className="w-fit">
                  {ROLE_LABELS[user.role]}
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/cuenta" />}>
                Mi cuenta
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/estado" />}>
                Estado del sistema
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/auditoria" />}>
                Auditoría
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<a href={getLogoutHref()} />}>
                <LogOutIcon />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button size="sm" nativeButton={false} render={<Link href="/iniciar-sesion" />}>
            Entrar
          </Button>
        )}
      </div>
    </header>
  );
}
