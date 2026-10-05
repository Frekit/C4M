import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { converter, parse, wcagContrast } from "culori";

const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const rootStart = css.indexOf(":root {");
const root = css.slice(rootStart, css.indexOf(".dark {", rootStart));
const toRgb = converter("rgb");

function token(name: string) {
  const match = root.match(new RegExp(`${name}:\\s*(oklch\\([^)]+\\))`));
  assert.ok(match, `falta ${name} en :root`);
  return match[1];
}

function mix(foreground: string, background: string, amount: number) {
  const color = toRgb(parse(foreground));
  const base = toRgb(parse(background));
  assert.ok(color && base);
  return {
    mode: "rgb" as const,
    r: color.r * amount + base.r * (1 - amount),
    g: color.g * amount + base.g * (1 - amount),
    b: color.b * amount + base.b * (1 - amount),
  };
}

test("los tokens nuevos cumplen contraste de texto y de borde", () => {
  const background = token("--background");
  const card = token("--card");
  const pairs: Array<[string, string, number]> = [
    ["--success", "--success-muted", 4.5],
    ["--warning", "--warning-muted", 4.5],
    ["--info", "--info-muted", 4.5],
    ["--success-foreground", "--success", 4.5],
    ["--warning-foreground", "--warning", 4.5],
    ["--info-foreground", "--info", 4.5],
    ["--brand-text", "--background", 4.5],
    ["--brand-foreground", "--brand", 4.5],
    ["--foreground", "--background", 4.5],
    ["--muted-foreground", "--background", 4.5],
    ["--muted-foreground", "--muted", 4.5],
  ];

  for (const [ink, surface, minimum] of pairs) {
    const ratio = wcagContrast(token(ink), token(surface));
    assert.ok(
      ratio >= minimum,
      `${ink} sobre ${surface} es ${ratio.toFixed(2)}:1`
    );
  }

  const destructiveOnTint = wcagContrast(
    token("--destructive"),
    mix(token("--destructive"), card, 0.1)
  );
  assert.ok(
    destructiveOnTint >= 4.5,
    `destructive sobre destructive/10 es ${destructiveOnTint.toFixed(2)}:1`
  );

  const inputOnBackground = wcagContrast(token("--input"), background);
  assert.ok(
    inputOnBackground >= 3,
    `borde de input es ${inputOnBackground.toFixed(2)}:1`
  );
});
