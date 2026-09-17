import assert from "node:assert/strict";
import { test } from "node:test";

import { signContractSchema } from "@/lib/domain/validation";

// Lo que manda el navegador cuando el firmante rellena todo bien.
function completePayload() {
  return {
    kind: "INDIVIDUAL",
    legalName: "Aida Domenech Perez",
    taxId: "46123456X",
    country: "España",
    addressLine: "Carrer de Mallorca 100",
    city: "Barcelona",
    postalCode: "08036",
    region: "",
    accountHolder: "Aida Domenech Perez",
    payoutMethod: "BANK_TRANSFER",
    iban: "ES9121000418450200051332",
    swiftBic: "",
    bankName: "",
    wiseEmail: "",
    payoutCurrency: "EUR",
    vatApplies: "on",
    vatRate: "21",
    withholdingApplies: "on",
    withholdingRate: "15",
    taxRegime: "",
    billingEmail: "aida@example.com",
    phone: "",
    contactPerson: "",
    signerFullName: "Aida Domenech Perez",
    acceptTerms: "on",
  };
}

test("un formulario completo pasa la validación", () => {
  const result = signContractSchema.safeParse(completePayload());

  assert.equal(
    result.success,
    true,
    result.success ? "" : JSON.stringify(result.error.issues, null, 2)
  );
});

test("sin marcar las casillas de impuestos sigue siendo válido", () => {
  const payload = {
    ...completePayload(),
    vatApplies: false,
    vatRate: "",
    withholdingApplies: false,
    withholdingRate: "",
  };

  const result = signContractSchema.safeParse(payload);
  assert.equal(
    result.success,
    true,
    result.success ? "" : JSON.stringify(result.error.issues, null, 2)
  );
});

test("sin aceptar el contrato no se puede firmar", () => {
  const payload = { ...completePayload(), acceptTerms: null };
  const result = signContractSchema.safeParse(payload);

  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(
      result.error.issues.some((issue) => issue.path[0] === "acceptTerms")
    );
  }
});

test("los desplegables sin valor dan error localizable", () => {
  const payload = {
    ...completePayload(),
    kind: null,
    payoutMethod: null,
    payoutCurrency: null,
  };

  const result = signContractSchema.safeParse(payload);
  assert.equal(result.success, false);

  if (!result.success) {
    const paths = result.error.issues.map((issue) => issue.path[0]);
    assert.ok(paths.includes("kind"));
    assert.ok(paths.includes("payoutMethod"));
    assert.ok(paths.includes("payoutCurrency"));
  }
});
