import assert from "node:assert/strict";
import { test } from "node:test";

import { CONTRACT_STATUS, DELIVERABLE_STATUS } from "@/lib/domain/enums";
import {
  PLATFORM_ERROR_MAX,
  assertCanClearPlatformError,
  assertCanMarkPaid,
  assertCanMarkPlatformError,
  assertCanSubmitToPlatform,
  assertIdsSelected,
  parsePlatformErrorReason,
  parseSelectedIds,
  type PaidCommandItem,
  type PlatformCommandItem,
} from "@/lib/domain/finance-commands";
import { packKey } from "@/lib/domain/settlement";

const higgsfield = {
  settlementMode: "PER_CONTENT",
  requiresPlatformSubmit: true,
};

const manyChat = {
  settlementMode: "PACK",
  requiresPlatformSubmit: false,
};

function platformItem(
  overrides: Partial<PlatformCommandItem> = {}
): PlatformCommandItem {
  return {
    status: DELIVERABLE_STATUS.PUBLISHED,
    postUrl: "https://instagram.com/p/a",
    requiresPlatformSubmit: true,
    platformSubmitError: null,
    ...overrides,
  };
}

function paidItem(overrides: Partial<PaidCommandItem> = {}): PaidCommandItem {
  return {
    paidAt: null,
    contractStatus: CONTRACT_STATUS.SIGNED,
    status: DELIVERABLE_STATUS.SUBMITTED,
    campaignId: "camp-h",
    creatorId: "c1",
    policy: higgsfield,
    ...overrides,
  };
}

test("sin selección no se mueve nada en Finanzas", () => {
  const form = new FormData();
  assert.deepEqual(parseSelectedIds(form), []);
  assert.equal(assertIdsSelected([]).ok, false);
});

test("submitted exige cliente con plataforma, publicado y enlace", () => {
  assert.equal(assertCanSubmitToPlatform([platformItem()]).ok, true);

  const notPlatform = assertCanSubmitToPlatform([
    platformItem({ requiresPlatformSubmit: false }),
  ]);
  assert.equal(notPlatform.ok, false);
  if (!notPlatform.ok) {
    assert.match(notPlatform.error, /no tiene plataforma/);
  }

  assert.equal(
    assertCanSubmitToPlatform([
      platformItem({ status: DELIVERABLE_STATUS.SCHEDULED }),
    ]).ok,
    false
  );
  assert.equal(
    assertCanSubmitToPlatform([platformItem({ postUrl: null })]).ok,
    false
  );
});

test("el error de subida pide una razón y deja el contenido publicado", () => {
  assert.equal(parsePlatformErrorReason("no").ok, false);
  assert.equal(parsePlatformErrorReason("Rechazado por formato").ok, true);
  assert.equal(
    parsePlatformErrorReason("x".repeat(PLATFORM_ERROR_MAX + 1)).ok,
    false
  );
  assert.equal(assertCanMarkPlatformError([platformItem()]).ok, true);
  assert.equal(
    assertCanMarkPlatformError([
      platformItem({ requiresPlatformSubmit: false }),
    ]).ok,
    false
  );
});

test("volver a la cola solo aplica a publicados con nota de error", () => {
  assert.equal(
    assertCanClearPlatformError([
      platformItem({ platformSubmitError: "Rechazado por formato" }),
    ]).ok,
    true
  );
  assert.equal(assertCanClearPlatformError([platformItem()]).ok, false);
  assert.equal(
    assertCanClearPlatformError([
      platformItem({
        status: DELIVERABLE_STATUS.SUBMITTED,
        platformSubmitError: "Rechazado",
      }),
    ]).ok,
    false
  );
});

test("pagar submitted de plataforma no espera al pack", () => {
  const result = assertCanMarkPaid([paidItem()], new Map());
  assert.equal(result.ok, true);
});

test("publicado de Higgsfield no se paga hasta submitted", () => {
  const result = assertCanMarkPaid(
    [paidItem({ status: DELIVERABLE_STATUS.PUBLISHED })],
    new Map()
  );
  assert.equal(result.ok, false);
});

test("el pack solo se paga cuando está cerrado", () => {
  const items = [
    paidItem({
      status: DELIVERABLE_STATUS.PUBLISHED,
      campaignId: "camp-mc",
      policy: manyChat,
    }),
  ];
  const incomplete = assertCanMarkPaid(items, new Map());
  assert.equal(incomplete.ok, false);

  const complete = assertCanMarkPaid(
    items,
    new Map([[packKey("camp-mc", "c1"), true]])
  );
  assert.equal(complete.ok, true);
});

test("no se paga un contrato cancelado ni un ítem ya cobrado", () => {
  assert.equal(
    assertCanMarkPaid(
      [paidItem({ contractStatus: CONTRACT_STATUS.CANCELLED })],
      new Map()
    ).ok,
    false
  );
  assert.equal(
    assertCanMarkPaid([paidItem({ paidAt: new Date() })], new Map()).ok,
    false
  );
});
