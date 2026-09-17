import assert from "node:assert/strict";
import { test } from "node:test";

import { buildZexelLote, ZEXEL_CSV_HEADER } from "@/lib/domain/zexel-batch";
import type { PayoutGroup } from "@/lib/domain/finance-queues";

function group(
  overrides: Partial<PayoutGroup> & Pick<PayoutGroup, "creatorId" | "creatorHandle">
): PayoutGroup {
  return {
    payeeName: "Marcos SL",
    zexelEmail: "marcos@zexel.test",
    payoutCurrency: "EUR",
    items: [
      {
        id: "d1",
        position: 1,
        postUrl: null,
        paymentDueAt: null,
        clientSubmittedAt: null,
        costMinor: 12000,
        costCurrency: "EUR",
        creatorHandle: overrides.creatorHandle,
        contractCode: "CTR-2026-003",
        contractId: "ct-3",
      },
      {
        id: "d2",
        position: 2,
        postUrl: null,
        paymentDueAt: null,
        clientSubmittedAt: null,
        costMinor: 8000,
        costCurrency: "EUR",
        creatorHandle: overrides.creatorHandle,
        contractCode: "CTR-2026-003",
        contractId: "ct-3",
      },
    ],
    ...overrides,
  };
}

test("el lote de Zexel agrupa por perfil y moneda y suma importes", () => {
  const lote = buildZexelLote([
    group({ creatorId: "c1", creatorHandle: "marcosrouder" }),
    group({
      creatorId: "c2",
      creatorHandle: "g.tafalla",
      payeeName: "Guillermo",
      zexelEmail: "gui@zexel.test",
      items: [
        {
          id: "t1",
          position: 1,
          postUrl: null,
          paymentDueAt: null,
          clientSubmittedAt: null,
          costMinor: 5000,
          costCurrency: "USD",
          creatorHandle: "g.tafalla",
          contractCode: "CTR-2026-001",
          contractId: "ct-1",
        },
      ],
    }),
  ]);

  assert.equal(lote.ready.length, 2);
  assert.equal(lote.missingEmail.length, 0);
  assert.equal(lote.csv.split("\n")[0], ZEXEL_CSV_HEADER);
  assert.match(lote.csv, /marcos@zexel.test;200.00;EUR/);
  assert.match(lote.csv, /gui@zexel.test;50.00;USD/);
});

test("sin email no entra en el CSV y el resto del lote sigue", () => {
  const lote = buildZexelLote([
    group({ creatorId: "c1", creatorHandle: "marcosrouder" }),
    group({
      creatorId: "c3",
      creatorHandle: "marietefilms",
      zexelEmail: null,
      payeeName: null,
    }),
  ]);

  assert.equal(lote.ready.length, 1);
  assert.equal(lote.missingEmail[0]?.creatorHandle, "marietefilms");
  assert.doesNotMatch(lote.csv, /marietefilms/);
  assert.match(lote.csv, /marcos@zexel.test;200.00;EUR/);
});

test("el CSV solo incluye los contenidos seleccionados", () => {
  const lote = buildZexelLote(
    [group({ creatorId: "c1", creatorHandle: "marcosrouder" })],
    ["d1"]
  );

  assert.equal(lote.ready[0]?.amountMinor, 12000);
  assert.match(lote.csv, /marcos@zexel.test;120.00;EUR/);
  assert.doesNotMatch(lote.csv, /200.00/);
});
