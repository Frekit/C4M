import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";

import { LocalLoginForm } from "@/components/local-login-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthMode, isAuth0Configured, safeReturnTo } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/session";
import { getLoginHref, getSignupHref } from "@/lib/auth/urls";

export const metadata: Metadata = {
  title: "Iniciar sesión",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; motivo?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const authMode = getAuthMode();
  const missingAuth0 = params.motivo === "auth0" || !isAuth0Configured();

  if (user) {
    redirect(returnTo);
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-4 py-10 sm:px-6">
      {missingAuth0 && authMode === "local" ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>Auth0 todavía no está conectado</AlertTitle>
          <AlertDescription>
            Copia <code>.env.example</code> a <code>.env.local</code> con el
            dominio, client id, secret y <code>AUTH0_SECRET</code>. Mientras
            tanto, esta sesión local cubre el mismo contrato de usuario.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>
            {authMode === "auth0"
              ? "Usa Auth0 para login, registro y cierre de sesión."
              : "Usa una sesión local para seguir con el desarrollo."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {authMode === "auth0" ? (
            <div className="grid gap-2">
              <Button nativeButton={false} render={<a href={getLoginHref(returnTo)} />} size="lg">
                Continuar con Auth0
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={getSignupHref(returnTo)} />}
                size="lg"
              >
                Crear cuenta
              </Button>
            </div>
          ) : (
            <LocalLoginForm returnTo={returnTo} />
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Guía de configuración en el README y en{" "}
        <Link href="/estado" className="underline underline-offset-4">
          Estado
        </Link>
        .
      </p>
    </main>
  );
}
