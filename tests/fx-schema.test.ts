import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createCreatorContractSchema,
  fieldErrorsFrom,
  newClientContractSchema,
  optionalFxRate,
  renewalSchema,
} from "@/lib/domain/validation";

test("sin tipo de cambio en el formulario se usa el guardado", () => {
  assert.equal(optionalFxRate.parse(null), null);
  assert.equal(optionalFxRate.parse(undefined), null);
  assert.equal(optionalFxRate.parse(""), null);
});

test("acepta coma, punto o un número ya parseado", () => {
  assert.equal(optionalFxRate.parse("0,92"), 0.92);
  assert.equal(optionalFxRate.parse("0.92"), 0.92);
  assert.equal(optionalFxRate.parse(0.92), 0.92);
});

test("un tipo de cambio inválido no sale como Invalid input", () => {
  const result = optionalFxRate.safeParse("abc");
  assert.equal(result.success, false);
  if (!result.success) {
    const errors = fieldErrorsFrom(result.error);
    assert.equal(errors[""], "El tipo de cambio tiene que ser mayor que cero");
    assert.equal(
      Object.values(errors).some((message) => message === "Revisa este dato"),
      false
    );
  }
});

const creatorPayload = {
  instagram: "https://instagram.com/prueba_fx",
  displayName: "",
  contactEmail: "",
  deliverableCount: "6",
  salePricePerContent: "150",
  costCurrency: "EUR",
  costPerContent: "80",
  paymentTermDays: "30",
  notes: "",
  clientId: "client-1",
  campaignId: "",
};

test("alta de creator sin tipo de cambio no pide revisar fxUnitsPerUsd", () => {
  for (const fx of [null, undefined, ""]) {
    const result = createCreatorContractSchema.safeParse({
      ...creatorPayload,
      fxUnitsPerUsd: fx,
    });
    assert.equal(result.success, true, `fx=${String(fx)}`);
    if (result.success) {
      assert.equal(result.data.fxUnitsPerUsd, null);
    }
  }
});

test("contrato con otro cliente acepta el tipo de cambio vacío", () => {
  const result = newClientContractSchema.safeParse({
    creatorId: "creator-1",
    clientId: "client-2",
    campaignId: "",
    deliverableCount: "6",
    salePricePerContent: "150",
    costCurrency: "EUR",
    costPerContent: "80",
    fxUnitsPerUsd: null,
    paymentTermDays: "30",
    notes: "",
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.fxUnitsPerUsd, null);
  }
});

test("renovación acepta el tipo de cambio vacío", () => {
  const result = renewalSchema.safeParse({
    mode: "ANNEX",
    deliverableCount: "3",
    salePricePerContent: "150",
    costCurrency: "EUR",
    costPerContent: "80",
    fxUnitsPerUsd: null,
    paymentTermDays: "30",
    notes: "",
    campaignId: "",
  });
  assert.equal(result.success, true);
});
