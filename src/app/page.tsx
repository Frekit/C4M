import Link from "next/link";
import { KeyRound, Layers3, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthMode } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/session";
import { getLoginHref, getLogoutHref } from "@/lib/auth/urls";

export default async function HomePage() {
  const user = await getCurrentUser();
  const authMode = getAuthMode();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-16">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div className="space-y-4">
          <Badge variant="secondary">Capa base</Badge>
          <h1 className="font-heading max-w-xl text-3xl font-medium tracking-tight sm:text-4xl">
            Next.js y Auth0 listos para construir encima.
          </h1>
          <p className="max-w-xl text-muted-foreground text-pretty">
            Esta base deja el App Router, TypeScript, Tailwind, shadcn/ui y una
            capa de sesión unificada. Si Auth0 aún no está configurado, puedes
            entrar con una sesión local y seguir trabajando.
          </p>
          <div className="flex flex-wrap gap-2">
            {user ? (
              <>
                <Button nativeButton={false} render={<Link href="/cuenta" />} size="lg">
                  Abrir cuenta
                </Button>
                <Button
                  variant="outline"
                  nativeButton={false}
                  render={<a href={getLogoutHref()} />}
                  size="lg"
                >
                  Cerrar sesión
                </Button>
              </>
            ) : (
              <Button nativeButton={false} render={<Link href={getLoginHref()} />} size="lg">
                {authMode === "auth0" ? "Entrar con Auth0" : "Probar sesión local"}
              </Button>
            )}
            <Button variant="ghost" nativeButton={false} render={<Link href="/estado" />} size="lg">
              Ver estado
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sesión actual</CardTitle>
            <CardDescription>
              {authMode === "auth0"
                ? "Auth0 está activo. Las rutas /auth/login, /auth/callback y /auth/logout las monta el SDK."
                : "Auth0 no tiene credenciales. El modo local mantiene una cookie httpOnly para desarrollar."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Modo</span>
              <Badge variant={authMode === "auth0" ? "default" : "outline"}>
                {authMode === "auth0" ? "Auth0" : "Local"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Usuario</span>
              <span className="truncate font-medium">
                {user ? user.email || user.name : "Sin sesión"}
              </span>
            </div>
            <Button
              variant="outline"
              className="w-full"
              nativeButton={false}
              render={<Link href="/api/me" />}
            >
              GET /api/me
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <Layers3 className="size-4 text-muted-foreground" />
            <CardTitle>App Router</CardTitle>
            <CardDescription>
              Next.js 16, TypeScript estricto y layouts de servidor como punto
              de partida.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <KeyRound className="size-4 text-muted-foreground" />
            <CardTitle>Auth0 SDK v4</CardTitle>
            <CardDescription>
              Cliente en <code>src/lib/auth</code> y <code>src/proxy.ts</code>{" "}
              para login, callback y logout.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <ShieldCheck className="size-4 text-muted-foreground" />
            <CardTitle>Rutas protegidas</CardTitle>
            <CardDescription>
              <code>requireUser()</code> redirige a iniciar sesión. La cuenta y
              <code> /api/me</code> ya lo usan.
            </CardDescription>
          </CardHeader>
        </Card>
      </section>
    </main>
  );
}
