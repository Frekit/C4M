import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2Icon, CircleIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getAuth0EnvStatus,
  getAuthMode,
  getAuthModeSetting,
  isAuth0Configured,
} from "@/lib/auth/config";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { getCompany } from "@/lib/company";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";
import { envLabel, getRuntimeEnv } from "@/lib/runtime-env";
import { isMailConfigured } from "@/lib/mail/send";

import { FxRateForm } from "./fx-rate-form";

export const metadata: Metadata = {
  title: "Estado",
};

export default async function StatusPage() {
  const user = await requireUser("/estado");
  const canEditFx = can(user.role, "contracts:write");

  const authMode = getAuthMode();
  const modeSetting = getAuthModeSetting();
  const envStatus = getAuth0EnvStatus();
  const company = getCompany();
  const runtime = getRuntimeEnv();

  const [creators, contracts, signatures, pendingMail, rates] = await Promise.all([
    prisma.creator.count(),
    prisma.contract.count(),
    prisma.signatureRequest.count({ where: { status: "SIGNED" } }),
    prisma.mailJob.count({ where: { status: "PENDING" } }),
    prisma.fxRate.findMany({ orderBy: [{ currency: "asc" }] }),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Estado del sistema
        </h1>
        <p className="text-sm text-muted-foreground">
          Cómo está configurada la autenticación y qué hay cargado. El rastro
          de quién hizo qué está en{" "}
          <Link href="/auditoria" className="underline">
            Auditoría
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Entorno</CardTitle>
          <CardDescription>
            {envLabel(runtime.env)} · origen {runtime.source}. Local, pre y
            prod no comparten base ni Auth0.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">APP_ENV</span>
            <Badge variant={runtime.env === "prod" ? "default" : "outline"}>
              {runtime.env}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Base</span>
            <span>
              {runtime.databaseKind === "postgres"
                ? "PostgreSQL"
                : runtime.databaseKind === "sqlite"
                  ? "SQLite (solo local)"
                  : "Sin URL"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Semilla</span>
            <span>{runtime.allowSeed ? "Permitida" : "Bloqueada"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Indexable</span>
            <span>{runtime.noIndex ? "No (pre/local)" : "Sí"}</span>
          </div>
          {runtime.issues.length > 0 ? (
            <ul className="mt-1 grid gap-1 text-destructive">
              {runtime.issues.map((issue) => (
                <li key={issue.message}>
                  {issue.level === "error" ? "Error" : "Aviso"}: {issue.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              Este proceso cumple las reglas de {runtime.env}.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Autenticación</CardTitle>
            <CardDescription>
              {modeSetting === "auto"
                ? "AUTH_MODE=auto: usa Auth0 si están las cuatro variables."
                : `AUTH_MODE=${modeSetting}: forzado a mano.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Modo activo</span>
              <Badge>{authMode === "auth0" ? "Auth0" : "Local"}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tu sesión</span>
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tu rol</span>
              <span>{ROLE_LABELS[user.role]}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Correo de firma</span>
              <span>{isMailConfigured() ? "Resend listo" : "Sin API key"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Datos cargados</CardTitle>
            <CardDescription>
              {runtime.databaseKind === "postgres"
                ? "PostgreSQL de este entorno."
                : "Base de este proceso (SQLite en local)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Creators</span>
              <span>{creators}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contratos</span>
              <span>{contracts}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Firmados</span>
              <span>{signatures}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Correos en cola</span>
              <span>{pendingMail}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Variables de Auth0</CardTitle>
          <CardDescription>
            La aplicación en Auth0 debe ser Regular Web Application. Callback:{" "}
            <code>/auth/callback</code>.
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
                  <CheckCircle2Icon className="size-4 text-foreground" />
                ) : (
                  <CircleIcon className="size-4" />
                )}
                {item.present ? "Definida" : "Vacía"}
              </span>
            </div>
          ))}
          <p className="pt-1 text-sm text-muted-foreground">
            {isAuth0Configured()
              ? "Están las cuatro. Pon AUTH_MODE=auto para usar Auth0."
              : "Faltan credenciales, así que el modo local sigue disponible."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tipos de cambio guardados</CardTitle>
          <CardDescription>
            Se aplican al crear un contrato y quedan congelados en él.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {canEditFx ? <FxRateForm /> : null}
          <div className="grid gap-2 sm:grid-cols-2">
          {rates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay ninguno: al crear un contrato en otra moneda tendrás que
              escribirlo.
            </p>
          ) : (
            rates.map((rate) => (
              <div
                key={rate.id}
                className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <span className="font-medium">{rate.currency}</span>
                <span className="text-muted-foreground">
                  {rate.unitsPerUsd} / USD · {formatDate(rate.date)}
                </span>
              </div>
            ))
          )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parte contratante</CardTitle>
          <CardDescription>
            Aparece en los contratos. Se configura con variables de entorno
            (<code>COMPANY_*</code>) hasta que exista la entidad Sociedad.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Razón social</span>
            <span className="text-right">{company.legalName}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">NIF</span>
            <span>{company.taxId}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Domicilio</span>
            <span className="text-right">{company.address}</span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
