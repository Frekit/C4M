import assert from "node:assert/strict";
import { test } from "node:test";

import { SETTLEMENT_MODE } from "@/lib/domain/enums";
import { contractPaymentCopy } from "@/lib/domain/payment-copy";

test("por contenido el plazo nace en cada publicación", () => {
  const copy = contractPaymentCopy({
    settlementMode: SETTLEMENT_MODE.PER_CONTENT,
    paymentTermDays: 30,
  });

  assert.equal(copy.term, "30 días desde la publicación de cada contenido");
  assert.match(copy.body, /pago de cada contenido/);
  assert.doesNotMatch(copy.body, /pack/);
});

test("el pack se paga al publicar el último contenido de esa campaña", () => {
  const copy = contractPaymentCopy({
    settlementMode: SETTLEMENT_MODE.PACK,
    paymentTermDays: 30,
  });

  assert.equal(
    copy.term,
    "30 días desde la publicación del último contenido del pack"
  );
  assert.match(copy.body, /último contenido del pack/);
  assert.match(copy.body, /No se liquida cada pieza por separado/);
});

test("sin modo de liquidación se mantiene el texto por pieza, para no tocar PDFs ya firmados", () => {
  const copy = contractPaymentCopy({ paymentTermDays: 0 });

  assert.equal(copy.term, "Inmediato desde la publicación de cada contenido");
  assert.match(copy.body, /inmediata tras su publicación/);
});
