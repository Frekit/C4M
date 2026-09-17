import type { Metadata } from "next";
import { CheckCircle2, Circle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuth0EnvStatus, getAuthMode } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Estado",
};

export default async function StatusPage() {
  const user = await getCurrentUser();
  const authMode = getAuthMode();
  const envStatus = getAuth0EnvStatus();
  const auth0Ready = envStatus.every((item) => item.present);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Estado de la base
        </h1>
        <p className="text-sm text-muted-foreground">
          Comprueba si Auth0 está cableado y qué sesión hay ahora mismo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Autenticación</CardTitle>
            <CardDescription>
              El modo cambia solo con variables de entorno. No hace falta tocar
              código.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Modo activo</span>
              <Badge>{authMode === "auth0" ? "Auth0" : "Local"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Sesión</span>
              <span>{user ? user.email || user.name : "Ninguna"}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Runtime</CardTitle>
            <CardDescription>Stack de esta base.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Next.js 16 · App Router</p>
            <p>@auth0/nextjs-auth0 v4</p>
            <p>shadcn/ui · Tailwind v4</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Variables Auth0</CardTitle>
          <CardDescription>
            En el dashboard de Auth0, tipo Regular Web Application. Callback:{" "}
            <code>/auth/callback</code>. Logout: la URL base de la app.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {envStatus.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs sm:text-sm">{item.key}</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {item.present ? (
                  <CheckCircle2 className="size-4 text-foreground" />
                ) : (
                  <Circle className="size-4" />
                )}
                {item.present ? "Definida" : "Vacía"}
              </span>
            </div>
          ))}
          <p className="pt-2 text-sm text-muted-foreground">
            {auth0Ready
              ? "Auth0 tiene las cuatro variables. Reinicia el servidor si acabas de añadirlas."
              : "Faltan credenciales. El modo local sigue disponible."}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
