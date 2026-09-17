import assert from "node:assert/strict";
import { test } from "node:test";

import {
  convertToUsdCents,
  currencyDecimals,
  formatZexelAmount,
  fromMinorUnits,
  parseAmountToMinorUnits,
  toMinorUnits,
} from "@/lib/money";

test("cada moneda usa sus propios decimales", () => {
  assert.equal(currencyDecimals("EUR"), 2);
  assert.equal(currencyDecimals("usd"), 2);
  assert.equal(currencyDecimals("JPY"), 0);
  assert.equal(currencyDecimals("CLP"), 0);
  assert.equal(currencyDecimals("KWD"), 3);
});

test("los importes se guardan en unidades mínimas", () => {
  assert.equal(toMinorUnits(1200, "EUR"), 120000);
  assert.equal(toMinorUnits(1200, "JPY"), 1200);
  assert.equal(fromMinorUnits(120000, "EUR"), 1200);
  assert.equal(fromMinorUnits(1200, "JPY"), 1200);
  assert.equal(formatZexelAmount(20000, "EUR"), "200.00");
  assert.equal(formatZexelAmount(50, "JPY"), "50.00");
});

test("acepta coma o punto como separador decimal", () => {
  assert.equal(parseAmountToMinorUnits("1200,50", "EUR"), 120050);
  assert.equal(parseAmountToMinorUnits("1200.50", "EUR"), 120050);
  assert.equal(parseAmountToMinorUnits("1200", "EUR"), 120000);
});

test("rechaza lo que no es un importe", () => {
  assert.equal(parseAmountToMinorUnits("", "EUR"), null);
  assert.equal(parseAmountToMinorUnits("mil", "EUR"), null);
  assert.equal(parseAmountToMinorUnits("-100", "EUR"), null);
  assert.equal(parseAmountToMinorUnits("1.2.3", "EUR"), null);
});

test("redondear al céntimo no pierde dinero por acumulación", () => {
  // 0,1 + 0,2 en coma flotante da 0,30000000000000004; en enteros, 30 céntimos.
  assert.equal(
    toMinorUnits(0.1, "EUR") + toMinorUnits(0.2, "EUR"),
    toMinorUnits(0.3, "EUR")
  );
});

test("convierte a USD con el cambio del contrato", () => {
  // 1.200 EUR a 0,92 EUR por USD = 1.304,35 USD
  assert.equal(convertToUsdCents(120000, "EUR", 0.92), 130435);

  // Monedas con muchos ceros: 3.900.000 COP a 3900 por USD = 1.000 USD
  assert.equal(convertToUsdCents(390000000, "COP", 3900), 100000);

  // Sin decimales en la moneda de origen: 150.000 JPY a 150 por USD = 1.000 USD
  assert.equal(convertToUsdCents(150000, "JPY", 150), 100000);
});

test("un cambio inválido no genera importes absurdos", () => {
  assert.equal(convertToUsdCents(120000, "EUR", 0), 0);
  assert.equal(convertToUsdCents(120000, "EUR", -1), 0);
});
