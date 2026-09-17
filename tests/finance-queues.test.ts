import assert from "node:assert/strict";
import { test } from "node:test";

import {
  groupPackQueue,
  groupPayoutQueue,
  payableFromQueues,
  splitPlatformQueue,
  type PackQueueSource,
  type PlatformQueueSource,
  type PayoutQueueSource,
} from "@/lib/domain/finance-queues";

function platformItem(
  overrides: Partial<PlatformQueueSource> & Pick<PlatformQueueSource, "id">
): PlatformQueueSource {
  return {
    position: 1,
    postUrl: "https://instagram.com/p/a",
    publishedAt: new Date("2026-09-01T00:00:00.000Z"),
    campaignId: "camp-h",
    campaignName: "Higgs Q3",
    clientName: "Higgsfield",
    creatorHandle: "marcosrouder",
    contractCode: "CTR-2026-002",
    contractId: "ct-2",
    costMinor: 10000,
    costCurrency: "EUR",
    ...overrides,
  };
}

function packItem(
  overrides: Partial<PackQueueSource> &
    Pick<PackQueueSource, "id" | "creatorId" | "status">
): PackQueueSource {
  return {
    position: 1,
    postUrl: null,
    publishedAt: null,
    paymentDueAt: null,
    clientSubmittedAt: null,
    campaignId: "camp-mc",
    campaignName: "Many Chat Q3",
    clientName: "Many Chat",
    creatorHandle: "marcosrouder",
    contractId: "ct-3",
    contractCode: "CTR-2026-003",
    costMinor: 8000,
    costCurrency: "EUR",
    ...overrides,
  };
}

test("la cola de plataforma agrupa por campaña y deja fuera los publicados sin enlace", () => {
  const result = splitPlatformQueue([
    platformItem({ id: "d1" }),
    platformItem({
      id: "d2",
      postUrl: null,
      creatorHandle: "g.tafalla",
      contractCode: "CTR-2026-001",
      position: 2,
    }),
    platformItem({
      id: "d3",
      campaignId: "camp-h2",
      campaignName: "Higgs Q4",
    }),
  ]);

  assert.equal(result.readyCount, 2);
  assert.equal(result.groups.length, 2);
  assert.equal(result.groups[0]?.items.length, 1);
  assert.equal(result.missingLink.length, 1);
  assert.equal(result.missingLink[0]?.contractCode, "CTR-2026-001");
});

test("el pack incompleto no entra a pagar aunque haya piezas publicadas", () => {
  const items = [
    packItem({ id: "p1", creatorId: "c1", status: "PUBLISHED", position: 1 }),
    packItem({ id: "p2", creatorId: "c1", status: "SCHEDULED", position: 2 }),
  ];
  const packs = groupPackQueue(items);

  assert.equal(packs.length, 1);
  assert.equal(packs[0]?.isComplete, false);
  assert.equal(packs[0]?.published, 1);
  assert.deepEqual(payableFromQueues([], items, packs), []);
});

test("al cerrar el pack, las piezas en redes salen a pagar y se agrupan por perfil", () => {
  const due = new Date("2026-10-10T00:00:00.000Z");
  const items = [
    packItem({
      id: "p1",
      creatorId: "c1",
      status: "PUBLISHED",
      position: 1,
      paymentDueAt: due,
      publishedAt: new Date("2026-09-10T00:00:00.000Z"),
    }),
    packItem({
      id: "p2",
      creatorId: "c1",
      status: "PUBLISHED",
      position: 2,
      paymentDueAt: due,
    }),
  ];
  const packs = groupPackQueue(items);
  const payable = payableFromQueues([], items, packs);
  const payouts = groupPayoutQueue(
    payable,
    new Map([
      [
        "ct-3",
        {
          legalName: "Marcos SL",
          payoutMethod: "WISE",
          wiseEmail: "marcos@wise.test",
          iban: null,
          payoutCurrency: "EUR",
        },
      ],
    ])
  );

  assert.equal(packs[0]?.isComplete, true);
  assert.equal(packs[0]?.paymentDueAt, due.toISOString());
  assert.equal(payable.length, 2);
  assert.equal(payouts.length, 1);
  assert.equal(payouts[0]?.payeeName, "Marcos SL");
  assert.equal(payouts[0]?.account, "marcos@wise.test");
  assert.equal(payouts[0]?.items.length, 2);
});

test("submitted de plataforma se paga sin esperar a packs y no se duplica", () => {
  const submitted: PayoutQueueSource[] = [
    {
      id: "s1",
      position: 1,
      postUrl: "https://instagram.com/p/s",
      paymentDueAt: new Date("2026-09-20T00:00:00.000Z"),
      clientSubmittedAt: new Date("2026-09-02T00:00:00.000Z"),
      creatorId: "c2",
      creatorHandle: "g.tafalla",
      contractId: "ct-1",
      contractCode: "CTR-2026-001",
      costMinor: 12000,
      costCurrency: "EUR",
    },
  ];
  const packItems = [
    packItem({
      id: "s1",
      creatorId: "c2",
      status: "SUBMITTED",
      campaignId: "camp-other",
    }),
  ];
  const packs = groupPackQueue(packItems);
  const payable = payableFromQueues(submitted, packItems, packs);

  assert.equal(payable.length, 1);
  assert.equal(payable[0]?.id, "s1");
});
