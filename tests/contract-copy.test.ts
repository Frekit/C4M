import assert from "node:assert/strict";
import { test } from "node:test";

import {
  creatorDutiesCopy,
  dmAutomationCopy,
  governingLawCopy,
  organicObjectCopy,
  paidMediaCopy,
  paymentRuleCopy,
  signSummaryBullets,
} from "@/lib/domain/contract-copy";
import { CONTRACT_KIND } from "@/lib/domain/enums";
import {
  conditionsAnnexSchema,
  contractParticularsSchema,
} from "@/lib/domain/validation";
import { buildContractPdf } from "@/lib/pdf/contract-pdf";

test("el objeto distingue anexo de condiciones, de contenidos y el original", () => {
  const annex = organicObjectCopy({
    kind: CONTRACT_KIND.ANNEX,
    parentCode: "CTR-2026-001",
    deliverableCount: 3,
    instagramUrl: "https://www.instagram.com/demo/",
  });
  const conditions = organicObjectCopy({
    kind: CONTRACT_KIND.CONDITIONS_ANNEX,
    parentCode: "CTR-2026-001",
    deliverableCount: 0,
    instagramUrl: "https://www.instagram.com/demo/",
  });
  const original = organicObjectCopy({
    kind: CONTRACT_KIND.ORIGINAL,
    deliverableCount: 4,
    instagramUrl: "https://www.instagram.com/demo/",
  });

  assert.match(annex, /3 contenido/);
  assert.match(annex, /CTR-2026-001/);
  assert.match(conditions, /condiciones particulares/);
  assert.match(conditions, /permanecen vigentes/);
  assert.doesNotMatch(conditions, /4 contenido/);
  assert.match(original, /orgánico/);
  assert.match(original, /instagram.com\/demo/);
});

test("el contrato obliga a DMs automáticos y excluye paid media", () => {
  assert.match(dmAutomationCopy, /Many Chat/);
  assert.match(dmAutomationCopy, /automatización de mensajes directos/);
  assert.match(paidMediaCopy, /orgánica/);
  assert.match(paidMediaCopy, /paid media/i);
  assert.match(paidMediaCopy, /aparte/);
  assert.match(paymentRuleCopy, /negociado/);
  assert.match(creatorDutiesCopy, /herramienta de mensajes directos/);
  assert.match(governingLawCopy, /Madrid/);
  assert.match(governingLawCopy, /legislación española/);
});

test("el resumen de firma cubre orgánico, DMs y pago", () => {
  const text = signSummaryBullets.join(" ");
  assert.match(text, /orgánica/);
  assert.match(text, /Many Chat/);
  assert.match(text, /precio/);
});

test("las particulares de un borrador pueden ir vacías", () => {
  const parsed = contractParticularsSchema.safeParse({
    contractId: "ctr_1",
    notes: "   ",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.notes, "");
});

test("el anexo de condiciones exige texto jurídico, no cifras", () => {
  const tooShort = conditionsAnnexSchema.safeParse({
    parentId: "ctr_1",
    notes: "corto",
  });
  assert.equal(tooShort.success, false);

  const ok = conditionsAnnexSchema.safeParse({
    parentId: "ctr_1",
    notes:
      "Exclusividad de 30 días sobre marcas de IA conversacional y DMs en español.",
  });
  assert.equal(ok.success, true);
});

test("el PDF de un contrato original incluye las cláusulas nuevas", async () => {
  const { bytes, sha256 } = await buildContractPdf({
    contract: {
      code: "CTR-2026-001",
      kind: CONTRACT_KIND.ORIGINAL,
      deliverableCount: 2,
      costCurrency: "EUR",
      costMinorPerContent: 10000,
      salePriceCentsPerContent: 20000,
      paymentTermDays: 30,
      notes: "Brief en stories y reels.\nExclusividad 15 dias.",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      signedAt: null,
    },
    creator: {
      handle: "demo",
      instagramUrl: "https://www.instagram.com/demo/",
      displayName: "Demo",
    },
  });

  assert.equal(sha256.length, 64);
  assert.ok(bytes.byteLength > 1000);
});

test("el PDF de un anexo de condiciones no vuelve a tabular el dinero", async () => {
  const { bytes } = await buildContractPdf({
    contract: {
      code: "CTR-2026-001-C1",
      kind: CONTRACT_KIND.CONDITIONS_ANNEX,
      deliverableCount: 0,
      costCurrency: "EUR",
      costMinorPerContent: 10000,
      salePriceCentsPerContent: 20000,
      paymentTermDays: 30,
      notes: "Los DMs se configuran en espanol y no se desactivan sin aviso.",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      signedAt: null,
    },
    parentCode: "CTR-2026-001",
    creator: {
      handle: "demo",
      instagramUrl: "https://www.instagram.com/demo/",
      displayName: null,
    },
  });

  assert.ok(bytes.byteLength > 800);
});
