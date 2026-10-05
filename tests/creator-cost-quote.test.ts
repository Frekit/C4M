import assert from "node:assert/strict";
import test from "node:test";

import {
  costPackageLabel,
  parseCostQuoteInput,
  perContentFromPackage,
  quotePackageText,
  sortCostQuotes,
} from "../src/lib/domain/creator-cost-quote";

test("1 reel, 3 reels, 1 story y 2 carruseles se leen como paquetes", () => {
  assert.equal(costPackageLabel("INSTAGRAM", "REEL", 1), "1 reel");
  assert.equal(costPackageLabel("INSTAGRAM", "REEL", 3), "3 reels");
  assert.equal(costPackageLabel("INSTAGRAM", "STORY", 1), "1 story");
  assert.equal(costPackageLabel("INSTAGRAM", "STORY", 4), "4 stories");
  assert.equal(costPackageLabel("INSTAGRAM", "CAROUSEL", 1), "1 carrusel");
  assert.equal(costPackageLabel("INSTAGRAM", "CAROUSEL", 2), "2 carruseles");
  assert.equal(costPackageLabel("TIKTOK", "VIDEO", 3), "3 vídeos");
  assert.equal(costPackageLabel("X", "THREAD", 1), "1 hilo");
  assert.equal(
    quotePackageText("LINKEDIN", "POST", 2),
    "LinkedIn · 2 posts"
  );
  assert.equal(quotePackageText(null, "REEL", 1), "Instagram · 1 reel");
});

test("el coste es el del paquete y ordena reel, story, carrusel", () => {
  const parsed = parseCostQuoteInput({
    format: "REEL",
    quantity: "3",
    amount: "400",
    currency: "eur",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.costMinor, 40000);
  assert.equal(parsed.currency, "EUR");

  const sorted = sortCostQuotes([
    { format: "CAROUSEL", quantity: 1 },
    { format: "REEL", quantity: 3 },
    { format: "STORY", quantity: 1 },
    { format: "REEL", quantity: 1 },
  ]);
  assert.deepEqual(
    sorted.map((item) => `${item.format}:${item.quantity}`),
    ["REEL:1", "REEL:3", "STORY:1", "CAROUSEL:1"]
  );
});

test("8 reels a 1.000 € parten exacto; un total que no cuadra no entra", () => {
  const even = perContentFromPackage(100000, 8);
  assert.equal(even.ok, true);
  if (!even.ok) return;
  assert.equal(even.perContentMinor, 12500);

  const odd = perContentFromPackage(99900, 8);
  assert.equal(odd.ok, false);
});

test("cada red solo acepta sus formatos", () => {
  const tiktok = parseCostQuoteInput({
    platform: "tiktok",
    format: "VIDEO",
    quantity: "1",
    amount: "200",
    currency: "EUR",
  });
  assert.equal(tiktok.ok, true);
  if (!tiktok.ok) return;
  assert.equal(tiktok.platform, "TIKTOK");

  assert.equal(
    parseCostQuoteInput({
      platform: "INSTAGRAM",
      format: "POST",
      quantity: "1",
      amount: "100",
      currency: "EUR",
    }).ok,
    false
  );
  assert.equal(
    parseCostQuoteInput({
      platform: "X",
      format: "THREAD",
      quantity: "1",
      amount: "90",
      currency: "EUR",
    }).ok,
    true
  );
});

test("un formato desconocido o un coste vacío no entra", () => {
  assert.equal(
    parseCostQuoteInput({
      format: "POST",
      quantity: "1",
      amount: "100",
      currency: "EUR",
    }).ok,
    false
  );
  const empty = parseCostQuoteInput({
    format: "STORY",
    quantity: "1",
    amount: "",
    currency: "EUR",
  });
  assert.equal(empty.ok, false);
  if (empty.ok) return;
  assert.match(empty.error, /coste/);
});
