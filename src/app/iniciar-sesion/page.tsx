import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AlertCircleIcon, InfoIcon } from "lucide-react";

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
import { getAuthMode, isAuth0Active, safeReturnTo } from "@/lib/auth/config";
import { auth0LoginAlert } from "@/lib/auth/loopback";
import { getAccessState } from "@/lib/auth/session";
import { getLoginHref } from "@/lib/auth/urls";

export const metadata: Metadata = {
  title: "Entrar",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    returnTo?: string;
    motivo?: string;
    error?: string;
    email?: string;
    detalle?: string;
  }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const state = await getAccessState();

  if (state.kind === "active") {
    redirect(returnTo);
  }

  if (state.kind === "not_invited" || state.kind === "disabled") {
    redirect(`/sin-acceso?motivo=${state.kind}`);
  }

  const authMode = getAuthMode();
  const auth0Alert =
    params.error === "auth0" ? auth0LoginAlert(params.detalle) : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-4 py-12 sm:px-6">
      <div className="space-y-1 text-center">
        <h1 className="font-heading text-xl font-medium tracking-tight">
          Contratos con creators
        </h1>
        <p className="text-sm text-muted-foreground">
          Registro de talento, contratos y firma en un sitio.
        </p>
      </div>

      {params.error === "sin-invitacion" ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Ese correo no está invitado</AlertTitle>
          <AlertDescription>
            Pide a un administrador que te invite y abre el enlace que recibas.
          </AlertDescription>
        </Alert>
      ) : null}

      {auth0Alert ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{auth0Alert.title}</AlertTitle>
          <AlertDescription>{auth0Alert.description}</AlertDescription>
        </Alert>
      ) : null}

      {params.motivo === "auth0" && !isAuth0Active() ? (
        <Alert>
          <InfoIcon />
          <AlertTitle>Auth0 está desactivado ahora mismo</AlertTitle>
          <AlertDescription>
            La variable <code>AUTH_MODE</code> está en <code>local</code>. Cámbiala
            a <code>auto</code> cuando el tenant tenga dadas de alta las URLs de
            callback.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Acceso del equipo</CardTitle>
          <CardDescription>
            {authMode === "auth0"
              ? "Entra con tu cuenta de Auth0. Solo se permite el paso a cuentas invitadas."
              : "Modo local de desarrollo: basta el correo de una cuenta invitada."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authMode === "auth0" ? (
            <Button
              className="w-full"
              size="lg"
              nativeButton={false}
              render={<a href={getLoginHref(returnTo)} />}
            >
              Continuar con Auth0
            </Button>
          ) : (
            <LocalLoginForm returnTo={returnTo} defaultEmail={params.email} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
