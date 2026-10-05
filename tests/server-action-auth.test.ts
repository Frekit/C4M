import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

// Acciones públicas a propósito. Tienen que validar el token del enlace;
// no hay sesión de equipo.
const TOKEN_ACTIONS = new Map<string, readonly string[]>([
  ["src/app/campanas/curation-actions.ts", ["postClientMessage"]],
  ["src/app/firmar/[token]/actions.ts", ["signContract"]],
  ["src/app/invitacion/[token]/actions.ts", ["acceptInvitation"]],
]);

type ExportedAction = { name: string; body: string };

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) files.push(path);
  }
  return files;
}

function isUseServerFile(source: string) {
  const start = source.trimStart();
  return start.startsWith('"use server"') || start.startsWith("'use server'");
}

function extractExportedAsyncFunctions(source: string): ExportedAction[] {
  const actions: ExportedAction[] = [];
  const marker = "export async function ";
  let cursor = 0;

  while (cursor < source.length) {
    const at = source.indexOf(marker, cursor);
    if (at === -1) break;
    let i = at + marker.length;
    const nameStart = i;
    while (i < source.length && /[\w$]/.test(source[i])) i += 1;
    const name = source.slice(nameStart, i);
    const bodyStart = findBodyStart(source, i);
    const bodyEnd = findBodyEnd(source, bodyStart);
    actions.push({ name, body: source.slice(bodyStart, bodyEnd) });
    cursor = bodyEnd;
  }

  return actions;
}

function findBodyStart(source: string, from: number) {
  let paren = 0;
  let angle = 0;
  let i = from;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "(") paren += 1;
    else if (ch === ")") paren = Math.max(0, paren - 1);
    else if (ch === "<" && paren === 0) angle += 1;
    else if (ch === ">" && paren === 0 && angle > 0) angle -= 1;
    else if (ch === "{" && paren === 0 && angle === 0) return i + 1;
    i += 1;
  }
  throw new Error("No encuentro el cuerpo de una server action.");
}

function findBodyEnd(source: string, from: number) {
  let depth = 1;
  let i = from;
  let quote: '"' | "'" | "`" | null = null;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    const prev = source[i - 1];
    if (quote) {
      if (ch === quote && prev !== "\\") quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  return i - 1;
}

function useServerFiles() {
  return walk(join(SRC, "app"))
    .map((path) => ({ path, rel: relative(ROOT, path), source: readFileSync(path, "utf8") }))
    .filter((file) => isUseServerFile(file.source));
}

test("cada server action exportada comprueba permiso o valida su token", () => {
  const reviewed: string[] = [];

  for (const file of useServerFiles()) {
    const actions = extractExportedAsyncFunctions(file.source);
    assert.ok(actions.length > 0, `${file.rel} no exporta ninguna acción`);
    const allowed = new Set(TOKEN_ACTIONS.get(file.rel) ?? []);

    for (const action of actions) {
      if (allowed.has(action.name)) {
        assert.match(action.body, /token/, `${file.rel}#${action.name} no lee un token`);
        assert.match(
          action.body,
          /findUnique|findFirst/,
          `${file.rel}#${action.name} no busca el token`
        );
        continue;
      }
      assert.match(
        action.body,
        /requireUser\(|requirePermission\(/,
        `${file.rel}#${action.name} no llama a requireUser ni requirePermission`
      );
    }

    for (const name of allowed) {
      assert.ok(
        actions.some((action) => action.name === name),
        `${file.rel} ya no exporta la acción pública ${name}`
      );
    }
    reviewed.push(file.rel);
  }

  assert.deepEqual(
    reviewed.sort(),
    [
      "src/app/campanas/actions.ts",
      "src/app/campanas/curation-actions.ts",
      "src/app/campanas/roster-actions.ts",
      "src/app/clientes/actions.ts",
      "src/app/contenidos/actions.ts",
      "src/app/contratos/actions.ts",
      "src/app/creators/actions.ts",
      "src/app/creators/catalog-actions.ts",
      "src/app/creators/cost-quote-actions.ts",
      "src/app/creators/roster-actions.ts",
      "src/app/equipo/actions.ts",
      "src/app/estado/actions.ts",
      "src/app/finanzas/actions.ts",
      "src/app/firmar/[token]/actions.ts",
      "src/app/invitacion/[token]/actions.ts",
    ]
  );
});

test("revalidateCampaign y placeCreatorOnCampaign no son endpoints", () => {
  const placement = readFileSync(
    join(SRC, "lib/domain/campaign-placement.ts"),
    "utf8"
  );
  assert.match(placement, /import "server-only"/);
  assert.equal(isUseServerFile(placement), false);
  assert.match(placement, /export async function revalidateCampaign/);
  assert.match(placement, /export async function placeCreatorOnCampaign/);

  for (const file of useServerFiles()) {
    const names = extractExportedAsyncFunctions(file.source).map((action) => action.name);
    assert.equal(names.includes("revalidateCampaign"), false, file.rel);
    assert.equal(names.includes("placeCreatorOnCampaign"), false, file.rel);
  }
});
