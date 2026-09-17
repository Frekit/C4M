import assert from "node:assert/strict";
import { test } from "node:test";

import {
  creatorPaymentRows,
  paidAuditMetadata,
  settledPayment,
  sumPaymentsByCurrency,
} from "@/lib/domain/creator-payments";

test("si hay importe congelado manda sobre el del contrato", () => {
  assert.deepEqual(
    settledPayment({
      paidMinor: 15000,
      paidCurrency: "EUR",
      costMinor: 20000,
      costCurrency: "USD",
    }),
    { amountMinor: 15000, currency: "EUR" }
  );
});

test("sin congelar usa el coste del contrato", () => {
  assert.deepEqual(
    settledPayment({
      paidMinor: null,
      paidCurrency: null,
      costMinor: 20000,
      costCurrency: "USD",
    }),
    { amountMinor: 20000, currency: "USD" }
  );
});

test("el historial solo incluye pagados y va del más reciente al más viejo", () => {
  const rows = creatorPaymentRows([
    {
      id: "old",
      position: 1,
      paidAt: new Date("2026-01-01T00:00:00.000Z"),
      paidByEmail: "ana@cfmedia.es",
      paidMinor: 1000,
      paidCurrency: "EUR",
      postUrl: null,
      costMinor: 1000,
      costCurrency: "EUR",
      contractId: "c1",
      contractCode: "HF-1",
      campaignName: "A",
      clientName: "Higgsfield",
    },
    {
      id: "open",
      position: 2,
      paidAt: null,
      paidByEmail: null,
      paidMinor: null,
      paidCurrency: null,
      postUrl: null,
      costMinor: 1000,
      costCurrency: "EUR",
      contractId: "c1",
      contractCode: "HF-1",
      campaignName: "A",
      clientName: "Higgsfield",
    },
    {
      id: "new",
      position: 3,
      paidAt: new Date("2026-02-01T00:00:00.000Z"),
      paidByEmail: null,
      paidMinor: null,
      paidCurrency: null,
      postUrl: "https://instagram.com/p/x",
      costMinor: 2500,
      costCurrency: "EUR",
      contractId: "c2",
      contractCode: "HF-2",
      campaignName: "B",
      clientName: "Higgsfield",
    },
  ]);

  assert.deepEqual(
    rows.map((row) => row.id),
    ["new", "old"]
  );
  assert.equal(rows[0]?.amountMinor, 2500);
  assert.equal(rows[1]?.paidByEmail, "ana@cfmedia.es");
});

test("suma pagado por moneda", () => {
  assert.deepEqual(
    sumPaymentsByCurrency([
      { amountMinor: 100, currency: "EUR" },
      { amountMinor: 40, currency: "USD" },
      { amountMinor: 25, currency: "EUR" },
    ]),
    { EUR: 125, USD: 40 }
  );
});

test("la auditoría del lote guarda quién, cuánto y qué contenidos", () => {
  const paidAt = new Date("2026-09-17T10:00:00.000Z");
  const meta = paidAuditMetadata({
    paidAt,
    items: [
      {
        id: "d1",
        position: 1,
        creatorId: "cr1",
        creatorHandle: "ana",
        contractId: "c1",
        contractCode: "HF-1",
        campaignId: "camp",
        amountMinor: 10000,
        currency: "EUR",
      },
    ],
  });
  assert.equal(meta.count, 1);
  assert.equal(meta.paidAt, paidAt.toISOString());
  assert.equal(meta.items[0]?.creatorHandle, "ana");
  assert.equal(meta.items[0]?.amountMinor, 10000);
});
