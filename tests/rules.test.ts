import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canCreateConditionsAnnex,
  canDeleteContract,
  canEditContractParticulars,
  canPublishDeliverables,
  countPublished,
  isAnnexAllowed,
  nextContractStatusAfterProgress,
} from "@/lib/domain/rules";

test("el anexo vale si el coste del creator no cambia", () => {
  const parent = { costCurrency: "EUR", costMinorPerContent: 120000 };

  assert.equal(isAnnexAllowed(parent, { ...parent }), true);
});

test("el anexo no vale si cambia el importe o la moneda", () => {
  const parent = { costCurrency: "EUR", costMinorPerContent: 120000 };

  assert.equal(
    isAnnexAllowed(parent, { costCurrency: "EUR", costMinorPerContent: 150000 }),
    false
  );
  assert.equal(
    isAnnexAllowed(parent, { costCurrency: "USD", costMinorPerContent: 120000 }),
    false
  );
});

test("publicado se puede forzar si el contrato sigue sin firmar, no si está cancelado", () => {
  assert.equal(canPublishDeliverables("SIGNED"), true);
  assert.equal(canPublishDeliverables("COMPLETED"), true);
  assert.equal(canPublishDeliverables("RENEWED"), true);
  assert.equal(canPublishDeliverables("DRAFT"), true);
  assert.equal(canPublishDeliverables("SENT"), true);
  assert.equal(canPublishDeliverables("CANCELLED"), false);
});

test("un borrador no se completa aunque estén todos los posts en redes", () => {
  assert.equal(nextContractStatusAfterProgress("DRAFT", true), "DRAFT");
  assert.equal(nextContractStatusAfterProgress("SENT", true), "SENT");
  assert.equal(nextContractStatusAfterProgress("SIGNED", true), "COMPLETED");
  assert.equal(nextContractStatusAfterProgress("RENEWED", true), "COMPLETED");
  assert.equal(nextContractStatusAfterProgress("CANCELLED", true), "CANCELLED");
  assert.equal(nextContractStatusAfterProgress("COMPLETED", false), "SIGNED");
});

test("un borrador virgen se puede borrar", () => {
  assert.equal(
    canDeleteContract({
      status: "DRAFT",
      signatureCount: 0,
      publishedCount: 0,
      childCount: 0,
    }),
    true
  );
});

test("con firma, publicaciones o descendientes ya no se borra", () => {
  const virgin = {
    status: "DRAFT",
    signatureCount: 0,
    publishedCount: 0,
    childCount: 0,
  };

  assert.equal(canDeleteContract({ ...virgin, signatureCount: 1 }), false);
  assert.equal(canDeleteContract({ ...virgin, publishedCount: 1 }), false);
  assert.equal(canDeleteContract({ ...virgin, childCount: 1 }), false);
  assert.equal(canDeleteContract({ ...virgin, status: "SIGNED" }), false);
  assert.equal(canDeleteContract({ ...virgin, status: "CANCELLED" }), false);
});

test("cuenta los contenidos ya en redes, publicados o submitted", () => {
  assert.equal(
    countPublished([
      { status: "PUBLISHED" },
      { status: "PENDING" },
      { status: "SUBMITTED" },
    ]),
    2
  );
  assert.equal(countPublished([]), 0);
});

test("las particulares se editan en borrador o enviado, no si ya firmó", () => {
  assert.equal(canEditContractParticulars("DRAFT", false), true);
  assert.equal(canEditContractParticulars("SENT", false), true);
  assert.equal(canEditContractParticulars("SENT", true), false);
  assert.equal(canEditContractParticulars("SIGNED", false), false);
  assert.equal(canEditContractParticulars("CANCELLED", false), false);
});

test("el anexo de condiciones solo nace de un contrato ya firmado", () => {
  assert.equal(canCreateConditionsAnnex("SIGNED"), true);
  assert.equal(canCreateConditionsAnnex("COMPLETED"), true);
  assert.equal(canCreateConditionsAnnex("RENEWED"), true);
  assert.equal(canCreateConditionsAnnex("DRAFT"), false);
  assert.equal(canCreateConditionsAnnex("SENT"), false);
  assert.equal(canCreateConditionsAnnex("CANCELLED"), false);
});
