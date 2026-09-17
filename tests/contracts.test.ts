import assert from "node:assert/strict";
import { test } from "node:test";

import {
  accruedMinor,
  contractTotals,
  costPerContentUsdCents,
  deliverableProgress,
  paymentDueDate,
} from "@/lib/domain/contract-math";
import { extractInstagramHandle } from "@/lib/domain/validation";

const contract = {
  deliverableCount: 3,
  salePriceCentsPerContent: 250000, // 2.500 USD
  costCurrency: "EUR",
  costMinorPerContent: 120000, // 1.200 EUR
  fxUnitsPerUsd: 0.92,
  costUsdCentsPerContent: costPerContentUsdCents(120000, "EUR", 0.92),
};

test("los totales del contrato salen de los importes por contenido", () => {
  const totals = contractTotals(contract);

  assert.equal(totals.saleTotalCents, 750000);
  assert.equal(totals.costTotalMinor, 360000);
  assert.equal(totals.costTotalUsdCents, 391305);
  assert.equal(totals.marginTotalUsdCents, 358695);
  assert.equal(totals.hasNegativeMargin, false);
  assert.ok(totals.marginRatio !== null && totals.marginRatio > 0.47);
});

test("detecta el margen negativo", () => {
  const totals = contractTotals({
    ...contract,
    salePriceCentsPerContent: 100000, // se vende por debajo del coste
  });

  assert.equal(totals.hasNegativeMargin, true);
  assert.ok(totals.marginTotalUsdCents < 0);
});

test("el plazo de pago cuenta desde la publicación", () => {
  const published = new Date("2026-01-15T00:00:00.000Z");

  assert.equal(
    paymentDueDate(published, 30).toISOString(),
    "2026-02-14T00:00:00.000Z"
  );
  assert.equal(
    paymentDueDate(published, 0).toISOString(),
    "2026-01-15T00:00:00.000Z"
  );
  assert.equal(
    paymentDueDate(published, 7).toISOString(),
    "2026-01-22T00:00:00.000Z"
  );
});

test("solo lo publicado devenga", () => {
  const deliverables = [
    { status: "PUBLISHED", publishedAt: new Date(), paymentDueAt: new Date() },
    { status: "PUBLISHED", publishedAt: new Date(), paymentDueAt: new Date() },
    { status: "PENDING", publishedAt: null, paymentDueAt: null },
  ];

  const progress = deliverableProgress(deliverables);

  assert.equal(progress.total, 3);
  assert.equal(progress.published, 2);
  assert.equal(progress.pending, 1);
  assert.equal(progress.isComplete, false);
  assert.equal(accruedMinor(deliverables, 120000), 240000);
});

test("el contrato se completa solo cuando está todo publicado", () => {
  const all = [
    { status: "PUBLISHED", publishedAt: new Date(), paymentDueAt: new Date() },
    { status: "PUBLISHED", publishedAt: new Date(), paymentDueAt: new Date() },
  ];

  assert.equal(deliverableProgress(all).isComplete, true);
  assert.equal(deliverableProgress([]).isComplete, false);
});

test("saca el handle de cualquier forma de escribir el perfil", () => {
  assert.equal(
    extractInstagramHandle("https://www.instagram.com/dulceida/"),
    "dulceida"
  );
  assert.equal(extractInstagramHandle("instagram.com/Dulceida"), "dulceida");
  assert.equal(extractInstagramHandle("@dulceida"), "dulceida");
  assert.equal(extractInstagramHandle("dulceida"), "dulceida");
  assert.equal(extractInstagramHandle("perfil.con_puntos"), "perfil.con_puntos");
});

test("rechaza lo que no es un perfil de Instagram", () => {
  assert.equal(extractInstagramHandle(""), null);
  assert.equal(extractInstagramHandle("https://tiktok.com/@alguien"), null);
  assert.equal(extractInstagramHandle("con espacios"), null);
});
