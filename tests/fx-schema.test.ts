import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fieldErrorsFrom,
  optionalFxRate,
} from "@/lib/domain/validation";

test("sin tipo de cambio en el formulario se usa el guardado", () => {
  assert.equal(optionalFxRate.parse(null), null);
  assert.equal(optionalFxRate.parse(undefined), null);
  assert.equal(optionalFxRate.parse(""), null);
});

test("acepta coma o punto en el tipo de cambio", () => {
  assert.equal(optionalFxRate.parse("0,92"), 0.92);
  assert.equal(optionalFxRate.parse("0.92"), 0.92);
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
