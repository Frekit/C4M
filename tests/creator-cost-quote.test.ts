import assert from "node:assert/strict";
import test from "node:test";

import {
  costPackageLabel,
  parseCostQuoteInput,
  sortCostQuotes,
} from "../src/lib/domain/creator-cost-quote";

test("1 reel, 3 reels, 1 story y 2 carruseles se leen como paquetes", () => {
  assert.equal(costPackageLabel("REEL", 1), "1 reel");
  assert.equal(costPackageLabel("REEL", 3), "3 reels");
  assert.equal(costPackageLabel("STORY", 1), "1 story");
  assert.equal(costPackageLabel("STORY", 4), "4 stories");
  assert.equal(costPackageLabel("CAROUSEL", 1), "1 carrusel");
  assert.equal(costPackageLabel("CAROUSEL", 2), "2 carruseles");
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
