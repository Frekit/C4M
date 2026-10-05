import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertRuntimeEnv,
  databaseKindFromUrl,
  inspectRuntimeEnv,
  mailSubjectFor,
  resolveAppEnv,
} from "@/lib/runtime-env";

const auth0 = {
  AUTH0_DOMAIN: "tenant.eu.auth0.com",
  AUTH0_CLIENT_ID: "id",
  AUTH0_CLIENT_SECRET: "secret",
  AUTH0_SECRET: "0123456789abcdef0123456789abcdef",
};

test("sin APP_ENV, Vercel preview es pre y production es prod", () => {
  assert.deepEqual(resolveAppEnv({}), { env: "local", source: "default" });
  assert.deepEqual(resolveAppEnv({ VERCEL_ENV: "preview" }), {
    env: "pre",
    source: "VERCEL_ENV",
  });
  assert.deepEqual(resolveAppEnv({ VERCEL_ENV: "production" }), {
    env: "prod",
    source: "VERCEL_ENV",
  });
  assert.deepEqual(resolveAppEnv({ APP_ENV: "local", VERCEL_ENV: "production" }), {
    env: "local",
    source: "APP_ENV",
  });
});

test("local admite SQLite y AUTH_MODE=local", () => {
  const report = inspectRuntimeEnv({
    APP_ENV: "local",
    AUTH_MODE: "local",
    DATABASE_URL: "file:./dev.db",
  });
  assert.equal(report.ok, true);
  assert.equal(report.databaseKind, "sqlite");
  assert.equal(report.allowSeed, true);
  assert.equal(report.noIndex, true);
});

test("pre y prod rechazan local y SQLite", () => {
  const pre = inspectRuntimeEnv({
    APP_ENV: "pre",
    AUTH_MODE: "local",
    DATABASE_URL: "file:./dev.db",
  });
  assert.equal(pre.ok, false);
  assert.ok(pre.issues.some((issue) => /AUTH_MODE=local/.test(issue.message)));
  assert.ok(pre.issues.some((issue) => /PostgreSQL/.test(issue.message)));

  const prod = inspectRuntimeEnv({
    APP_ENV: "prod",
    AUTH_MODE: "auth0",
    ...auth0,
    DATABASE_URL: "postgresql://contratos:contratos@localhost:5432/contratos",
    APP_BASE_URL: "http://app.example",
  });
  assert.equal(prod.ok, false);
  assert.ok(prod.issues.some((issue) => /HTTPS/.test(issue.message)));

  const missingUrl = inspectRuntimeEnv({
    APP_ENV: "prod",
    AUTH_MODE: "auth0",
    ...auth0,
    DATABASE_URL: "postgresql://contratos:contratos@localhost:5432/contratos",
  });
  assert.equal(missingUrl.ok, false);
  assert.ok(missingUrl.issues.some((issue) => /APP_BASE_URL es obligatorio/.test(issue.message)));
  assert.throws(() =>
    assertRuntimeEnv({
      APP_ENV: "prod",
      AUTH_MODE: "auth0",
      ...auth0,
      DATABASE_URL: "postgresql://contratos:contratos@localhost:5432/contratos",
    })
  );
});

test("pre válido con Auth0, Postgres y APP_BASE_URL", () => {
  const report = inspectRuntimeEnv({
    APP_ENV: "pre",
    AUTH_MODE: "auth0",
    ...auth0,
    DATABASE_URL: "postgresql://contratos:contratos@localhost:5432/contratos",
    APP_BASE_URL: "https://pre.example.com",
  });
  assert.equal(report.ok, true);
  assert.equal(report.mailSubjectPrefix, "[PRE] ");
  assert.equal(report.allowSeed, true);
  assert.doesNotThrow(() =>
    assertRuntimeEnv({
      APP_ENV: "pre",
      AUTH_MODE: "auth0",
      ...auth0,
      DATABASE_URL: "postgresql://contratos:contratos@localhost:5432/contratos",
      APP_BASE_URL: "https://pre.example.com",
    })
  );
});

test("prod no siembra salvo ALLOW_PROD_SEED", () => {
  const blocked = inspectRuntimeEnv({
    APP_ENV: "prod",
    AUTH_MODE: "auth0",
    ...auth0,
    DATABASE_URL: "postgresql://x",
    APP_BASE_URL: "https://app.example.com",
  });
  assert.equal(blocked.allowSeed, false);
  const allowed = inspectRuntimeEnv({
    APP_ENV: "prod",
    ALLOW_PROD_SEED: "1",
    AUTH_MODE: "auth0",
    ...auth0,
    DATABASE_URL: "postgresql://x",
    APP_BASE_URL: "https://app.example.com",
  });
  assert.equal(allowed.allowSeed, true);
});

test("el asunto de pre lleva marca para no confundirlo con prod", () => {
  assert.equal(
    mailSubjectFor("Firma el contrato", { APP_ENV: "pre" }),
    "[PRE] Firma el contrato"
  );
  assert.equal(
    mailSubjectFor("Firma el contrato", { APP_ENV: "prod" }),
    "Firma el contrato"
  );
});

test("reconoce sqlite y postgres por la URL", () => {
  assert.equal(databaseKindFromUrl("file:./dev.db"), "sqlite");
  assert.equal(databaseKindFromUrl("postgresql://a@b/c"), "postgres");
  assert.equal(databaseKindFromUrl(""), "unknown");
});
