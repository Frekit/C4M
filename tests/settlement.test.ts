import assert from "node:assert/strict";
import { test } from "node:test";

import { SETTLEMENT_MODE } from "@/lib/domain/enums";
import {
  isAccruedDeliverable,
  isPackSettlement,
  isPayableWithPolicy,
  packPaymentDueAt,
  packProgress,
  summarizePacks,
} from "@/lib/domain/settlement";
import { resolveDeliverableState } from "@/lib/domain/rules";

const higgsfield = {
  settlementMode: SETTLEMENT_MODE.PER_CONTENT,
  requiresPlatformSubmit: true,
};

const manyChat = {
  settlementMode: SETTLEMENT_MODE.PACK,
  requiresPlatformSubmit: false,
};

test("Higgsfield devenga al publicar y solo se paga en submitted", () => {
  assert.equal(isAccruedDeliverable("PUBLISHED", higgsfield, false), true);
  assert.equal(isPayableWithPolicy("PUBLISHED", higgsfield, false), false);
  assert.equal(isPayableWithPolicy("SUBMITTED", higgsfield, false), true);
});

test("Many Chat no devenga ni se paga hasta completar el pack", () => {
  assert.equal(isPackSettlement(manyChat), true);
  assert.equal(isAccruedDeliverable("PUBLISHED", manyChat, false), false);
  assert.equal(isPayableWithPolicy("PUBLISHED", manyChat, false), false);
  assert.equal(isAccruedDeliverable("PUBLISHED", manyChat, true), true);
  assert.equal(isPayableWithPolicy("PUBLISHED", manyChat, true), true);
  assert.equal(isPayableWithPolicy("SUBMITTED", manyChat, true), true);
});

test("sin campaña el pack no está definido y no se paga publicado", () => {
  assert.equal(isPayableWithPolicy("PUBLISHED", null, false), false);
  assert.equal(isPayableWithPolicy("SUBMITTED", null, false), true);
});

test("el pack está completo solo si todas las piezas están en redes", () => {
  const incomplete = packProgress([
    { status: "PUBLISHED" },
    { status: "SCHEDULED" },
  ]);
  assert.equal(incomplete.published, 1);
  assert.equal(incomplete.total, 2);
  assert.equal(incomplete.isComplete, false);

  const complete = packProgress([
    { status: "PUBLISHED" },
    { status: "PUBLISHED" },
  ]);
  assert.equal(complete.isComplete, true);
});

test("al completar el pack la fecha de pago sale de la última publicación", () => {
  const due = packPaymentDueAt(
    [
      {
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-01T00:00:00.000Z"),
      },
      {
        status: "PUBLISHED",
        publishedAt: new Date("2026-09-10T00:00:00.000Z"),
      },
    ],
    30
  );

  assert.equal(due?.toISOString(), "2026-10-10T00:00:00.000Z");
  assert.equal(
    packPaymentDueAt(
      [
        {
          status: "PUBLISHED",
          publishedAt: new Date("2026-09-01T00:00:00.000Z"),
        },
        { status: "PENDING", publishedAt: null },
      ],
      30
    ),
    null
  );
});

test("publicar en pack no adelanta la fecha de pago", () => {
  const result = resolveDeliverableState({
    status: "PUBLISHED",
    contentDate: new Date("2026-09-05T00:00:00.000Z"),
    postUrl: "https://instagram.com/p/abc",
    paymentTermDays: 30,
    deferPayment: true,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.paymentDueAt, null);
    assert.equal(
      result.value.publishedAt?.toISOString(),
      "2026-09-05T00:00:00.000Z"
    );
  }
});

test("agrupa el progreso del pack por campaña y perfil", () => {
  const packs = summarizePacks([
    { campaignId: "c1", creatorId: "a", status: "PUBLISHED" },
    { campaignId: "c1", creatorId: "a", status: "PENDING" },
    { campaignId: "c1", creatorId: "b", status: "PUBLISHED" },
    { campaignId: null, creatorId: "a", status: "PUBLISHED" },
  ]);

  assert.equal(packs.get("c1:a")?.published, 1);
  assert.equal(packs.get("c1:a")?.total, 2);
  assert.equal(packs.get("c1:b")?.isComplete, true);
  assert.equal(packs.has("null:a"), false);
});
