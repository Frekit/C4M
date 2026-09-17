import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canDeleteContract,
  canPublishDeliverables,
  countPublished,
  isAnnexAllowed,
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

test("solo se marcan contenidos publicados con contrato firmado", () => {
  assert.equal(canPublishDeliverables("SIGNED"), true);
  assert.equal(canPublishDeliverables("COMPLETED"), true);
  assert.equal(canPublishDeliverables("RENEWED"), true);

  assert.equal(canPublishDeliverables("DRAFT"), false);
  assert.equal(canPublishDeliverables("SENT"), false);
  assert.equal(canPublishDeliverables("CANCELLED"), false);
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
