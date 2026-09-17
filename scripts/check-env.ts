import { existsSync, readFileSync } from "node:fs";

import {
  assertRuntimeEnv,
  inspectRuntimeEnv,
} from "../src/lib/runtime-env";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    const raw = trimmed.slice(index + 1).trim();
    const value = raw.replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const report = inspectRuntimeEnv();

console.log(
  JSON.stringify(
    {
      env: report.env,
      source: report.source,
      ok: report.ok,
      databaseKind: report.databaseKind,
      authMode: report.authMode,
      allowSeed: report.allowSeed,
      issues: report.issues,
    },
    null,
    2
  )
);

if (process.argv.includes("--strict") || report.env !== "local") {
  assertRuntimeEnv();
}
