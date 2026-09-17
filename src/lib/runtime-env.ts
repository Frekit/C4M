export const APP_ENVS = ["local", "pre", "prod"] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export type DatabaseKind = "sqlite" | "postgres" | "unknown";

export type RuntimeEnvIssue = {
  level: "error" | "warn";
  message: string;
};

export type RuntimeEnvReport = {
  env: AppEnv;
  source: "APP_ENV" | "VERCEL_ENV" | "default";
  databaseKind: DatabaseKind;
  authMode: string;
  appBaseUrl: string | null;
  allowSeed: boolean;
  noIndex: boolean;
  mailSubjectPrefix: string;
  issues: RuntimeEnvIssue[];
  ok: boolean;
};

const AUTH0_KEYS = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
] as const;

type EnvMap = Record<string, string | undefined>;

export function resolveAppEnv(env: EnvMap = process.env): {
  env: AppEnv;
  source: RuntimeEnvReport["source"];
} {
  const explicit = env.APP_ENV?.trim().toLowerCase();
  if (explicit === "local" || explicit === "pre" || explicit === "prod") {
    return { env: explicit, source: "APP_ENV" };
  }

  const vercel = env.VERCEL_ENV?.trim().toLowerCase();
  if (vercel === "production") return { env: "prod", source: "VERCEL_ENV" };
  if (vercel === "preview") return { env: "pre", source: "VERCEL_ENV" };

  return { env: "local", source: "default" };
}

export function databaseKindFromUrl(url: string | undefined): DatabaseKind {
  const value = url?.trim() ?? "";
  if (!value) return "unknown";
  if (value.startsWith("file:") || value.includes("file:")) return "sqlite";
  if (value.startsWith("postgres://") || value.startsWith("postgresql://")) {
    return "postgres";
  }
  return "unknown";
}

export function inspectRuntimeEnv(env: EnvMap = process.env): RuntimeEnvReport {
  const { env: appEnv, source } = resolveAppEnv(env);
  const databaseKind = databaseKindFromUrl(env.DATABASE_URL);
  const authSetting = (() => {
    const raw = env.AUTH_MODE?.trim().toLowerCase();
    return raw === "auth0" || raw === "local" ? raw : "auto";
  })();
  const auth0Ready = AUTH0_KEYS.every((key) => Boolean(env[key]?.trim()));
  const authMode =
    authSetting === "local"
      ? "local"
      : authSetting === "auth0"
        ? "auth0"
        : auth0Ready
          ? "auth0"
          : "local";
  const appBaseUrl = env.APP_BASE_URL?.trim().replace(/\/$/, "") || null;
  const allowSeed =
    appEnv !== "prod" || env.ALLOW_PROD_SEED?.trim() === "1";
  const issues: RuntimeEnvIssue[] = [];

  if (appEnv !== "local") {
    if (authSetting === "local" || authMode === "local") {
      issues.push({
        level: "error",
        message:
          "AUTH_MODE=local no vale fuera de tu máquina. En pre y prod usa Auth0.",
      });
    }

    if (!auth0Ready) {
      issues.push({
        level: "error",
        message:
          "Faltan AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET o AUTH0_SECRET.",
      });
    }

    if (databaseKind !== "postgres") {
      issues.push({
        level: "error",
        message:
          "Pre y prod exigen PostgreSQL (DATABASE_URL postgresql://…). SQLite es solo local.",
      });
    }

    if (!appBaseUrl) {
      issues.push({
        level: "error",
        message: "APP_BASE_URL es obligatorio en pre y prod (enlaces de firma).",
      });
    }
  }

  if (appEnv === "prod" && appBaseUrl && !appBaseUrl.startsWith("https://")) {
    issues.push({
      level: "error",
      message: "En producción APP_BASE_URL tiene que ser HTTPS.",
    });
  }

  if (appEnv === "pre" && appBaseUrl?.includes("localhost")) {
    issues.push({
      level: "warn",
      message: "APP_BASE_URL de pre apunta a localhost: los correos de firma no servirán.",
    });
  }

  if (appEnv === "prod" && !env.RESEND_API_KEY?.trim()) {
    issues.push({
      level: "warn",
      message: "Sin RESEND_API_KEY en prod los enlaces de firma hay que copiarlos a mano.",
    });
  }

  return {
    env: appEnv,
    source,
    databaseKind,
    authMode,
    appBaseUrl,
    allowSeed,
    noIndex: appEnv !== "prod",
    mailSubjectPrefix: appEnv === "pre" ? "[PRE] " : "",
    issues,
    ok: issues.every((issue) => issue.level !== "error"),
  };
}

export function assertRuntimeEnv(env: EnvMap = process.env): RuntimeEnvReport {
  const report = inspectRuntimeEnv(env);
  const errors = report.issues.filter((issue) => issue.level === "error");
  if (errors.length > 0) {
    throw new Error(
      `Entorno ${report.env} inválido:\n${errors.map((issue) => `- ${issue.message}`).join("\n")}`
    );
  }
  return report;
}

export function getRuntimeEnv(): RuntimeEnvReport {
  return inspectRuntimeEnv();
}

export function envLabel(env: AppEnv): string {
  if (env === "prod") return "Producción";
  if (env === "pre") return "Preproducción";
  return "Local";
}

export function mailSubjectFor(subject: string, env: EnvMap = process.env): string {
  const prefix = inspectRuntimeEnv(env).mailSubjectPrefix;
  if (!prefix || subject.startsWith(prefix)) return subject;
  return `${prefix}${subject}`;
}
