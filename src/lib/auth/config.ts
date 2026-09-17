import type { AuthMode } from "./types";

const AUTH0_ENV_KEYS = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
] as const;

export type AuthModeSetting = "auto" | "auth0" | "local";

// Interruptor explícito para no depender solo de que existan las variables:
// permite quedarse en local mientras el tenant de Auth0 se termina de configurar.
export function getAuthModeSetting(): AuthModeSetting {
  const raw = process.env.AUTH_MODE?.trim().toLowerCase();
  return raw === "auth0" || raw === "local" ? raw : "auto";
}

export function isAuth0Configured(): boolean {
  return AUTH0_ENV_KEYS.every((key) => Boolean(process.env[key]?.trim()));
}

export function getAuthMode(): AuthMode {
  const setting = getAuthModeSetting();

  if (setting === "local") return "local";
  if (setting === "auth0") return "auth0";

  return isAuth0Configured() ? "auth0" : "local";
}

// Auth0 solo se usa si además de estar elegido tiene credenciales completas.
export function isAuth0Active(): boolean {
  return getAuthMode() === "auth0" && isAuth0Configured();
}

export function getAuth0EnvStatus() {
  return AUTH0_ENV_KEYS.map((key) => ({
    key,
    present: Boolean(process.env[key]?.trim()),
  }));
}

export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
