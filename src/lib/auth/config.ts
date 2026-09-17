import type { AuthMode } from "./types";

const AUTH0_ENV_KEYS = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
] as const;

export function isAuth0Configured(): boolean {
  return AUTH0_ENV_KEYS.every((key) => Boolean(process.env[key]?.trim()));
}

export function getAuthMode(): AuthMode {
  return isAuth0Configured() ? "auth0" : "local";
}

export function getAuth0EnvStatus() {
  return AUTH0_ENV_KEYS.map((key) => ({
    key,
    present: Boolean(process.env[key]?.trim()),
  }));
}

export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/cuenta";
  }

  return value;
}
