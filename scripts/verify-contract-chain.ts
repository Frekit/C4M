// Comprobación de integración de la cadena de contratos y del PDF.
// Se ejecuta contra una base de datos aparte, no contra la de desarrollo:
//   DATABASE_URL="file:/tmp/verify.db" npx prisma migrate deploy
//   DATABASE_URL="file:/tmp/verify.db" npx tsx scripts/verify-contract-chain.ts

import assert from "node:assert/strict";

import { prisma } from "@/lib/db";
import { paymentDueDate } from "@/lib/domain/contract-math";
import {
  createContract,
  getContractChain,
  markParentRenewed,
  syncContractCompletion,
} from "@/lib/domain/contracts";
import { CONTRACT_KIND, CONTRACT_STATUS } from "@/lib/domain/enums";
import { buildContractPdf } from "@/lib/pdf/contract-pdf";
import { loadContractPdfInput } from "@/lib/pdf/contract-pdf-input";

const YEAR = new Date().getUTCFullYear();
const checks: string[] = [];

function ok(message: string) {
  checks.push(message);
  console.log(`  ok  ${message}`);
}

async function main() {
  if (!process.env.DATABASE_URL?.includes("/tmp/")) {
    throw new Error(
      "Ejecuta esto con DATABASE_URL apuntando a /tmp para no tocar la base de desarrollo."
    );
  }

  await prisma.auditEvent.deleteMany();
  await prisma.signatureRequest.deleteMany();
  await prisma.payeeProfile.deleteMany();
  await prisma.deliverable.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.creator.deleteMany();

  const creator = await prisma.creator.create({
    data: {
      handle: "perfil.de.prueba",
      instagramUrl: "https://www.instagram.com/perfil.de.prueba/",
      displayName: "Perfil De Prueba",
      payoutCurrency: "EUR",
    },
  });

  // --- Contrato inicial: 3 contenidos, 1.200 EUR de coste, 2.500 USD de venta ---
  const original = await createContract({
    creatorId: creator.id,
    kind: CONTRACT_KIND.ORIGINAL,
    economics: {
      deliverableCount: 3,
      salePriceCentsPerContent: 250000,
      costCurrency: "EUR",
      costMinorPerContent: 120000,
      costUsdCentsPerContent: 130435,
      fxUnitsPerUsd: 0.92,
      fxRateAt: new Date("2026-09-17T00:00:00.000Z"),
      fxSource: "TEST",
      paymentTermDays: 30,
      notes: "3 reels en feed",
    },
    createdBy: "verificacion@local",
  });

  assert.equal(original.code, `CTR-${YEAR}-001`);
  assert.equal(original.deliverables.length, 3);
  assert.equal(original.status, CONTRACT_STATUS.DRAFT);
  assert.equal(original.parentId, null);
  assert.equal(original.rootId, null);
  ok(`contrato inicial ${original.code} con 3 contenidos en borrador`);

  // --- Firma y publicación de los tres contenidos ---
  await prisma.contract.update({
    where: { id: original.id },
    data: { status: CONTRACT_STATUS.SIGNED, signedAt: new Date() },
  });

  const publishedAt = new Date("2026-09-17T00:00:00.000Z");

  for (const deliverable of original.deliverables) {
    await prisma.deliverable.update({
      where: { id: deliverable.id },
      data: {
        status: "PUBLISHED",
        publishedAt,
        paymentDueAt: paymentDueDate(publishedAt, 30),
      },
    });
  }

  await syncContractCompletion(original.id);

  const completed = await prisma.contract.findUniqueOrThrow({
    where: { id: original.id },
    include: { deliverables: true },
  });

  assert.equal(completed.status, CONTRACT_STATUS.COMPLETED);
  assert.ok(completed.completedAt);
  ok("al publicar el último contenido el contrato pasa a completado");

  assert.equal(
    completed.deliverables[0].paymentDueAt?.toISOString(),
    "2026-10-17T00:00:00.000Z"
  );
  ok("la fecha de pago se calcula a 30 días de la publicación");

  // --- Anexo: mismo coste, 2 contenidos más ---
  const annex = await createContract({
    creatorId: creator.id,
    kind: CONTRACT_KIND.ANNEX,
    parent: original,
    economics: {
      deliverableCount: 2,
      salePriceCentsPerContent: 250000,
      costCurrency: "EUR",
      costMinorPerContent: 120000,
      costUsdCentsPerContent: 130435,
      fxUnitsPerUsd: 0.92,
      fxRateAt: new Date("2026-09-17T00:00:00.000Z"),
      fxSource: "TEST",
      paymentTermDays: 30,
    },
    createdBy: "verificacion@local",
  });

  assert.equal(annex.code, `CTR-${YEAR}-001-A1`);
  assert.equal(annex.parentId, original.id);
  assert.equal(annex.rootId, original.id);
  assert.equal(annex.deliverables.length, 2);
  ok(`el anexo ${annex.code} cuelga del contrato inicial`);

  // Un anexo no debe cambiar el estado del padre.
  await markParentRenewed(original.id, CONTRACT_KIND.ANNEX);
  const afterAnnex = await prisma.contract.findUniqueOrThrow({
    where: { id: original.id },
  });
  assert.equal(afterAnnex.status, CONTRACT_STATUS.COMPLETED);
  ok("el anexo no marca el contrato original como renovado");

  // --- Renovación: coste distinto, contrato nuevo ---
  const renewal = await createContract({
    creatorId: creator.id,
    kind: CONTRACT_KIND.RENEWAL,
    parent: original,
    economics: {
      deliverableCount: 3,
      salePriceCentsPerContent: 280000,
      costCurrency: "EUR",
      costMinorPerContent: 150000,
      costUsdCentsPerContent: 163043,
      fxUnitsPerUsd: 0.92,
      fxRateAt: new Date("2026-09-17T00:00:00.000Z"),
      fxSource: "TEST",
      paymentTermDays: 7,
    },
    createdBy: "verificacion@local",
  });

  assert.equal(renewal.code, `CTR-${YEAR}-001-R1`);
  assert.equal(renewal.rootId, original.id);
  ok(`la renovación ${renewal.code} entra en la misma cadena`);

  await markParentRenewed(original.id, CONTRACT_KIND.RENEWAL);
  const afterRenewal = await prisma.contract.findUniqueOrThrow({
    where: { id: original.id },
  });
  assert.equal(afterRenewal.status, CONTRACT_STATUS.RENEWED);
  ok("la renovación sí marca el contrato original como renovado");

  // --- La cadena se lee de una vez ---
  const chain = await getContractChain(annex);
  assert.equal(chain.length, 3);
  assert.deepEqual(
    chain.map((contract) => contract.code),
    [`CTR-${YEAR}-001`, `CTR-${YEAR}-001-A1`, `CTR-${YEAR}-001-R1`]
  );
  ok("la cadena devuelve los tres contratos en orden");

  // --- Un segundo creator no reutiliza el numerador ---
  const other = await prisma.creator.create({
    data: {
      handle: "otro.perfil",
      instagramUrl: "https://www.instagram.com/otro.perfil/",
      payoutCurrency: "USD",
    },
  });

  const second = await createContract({
    creatorId: other.id,
    kind: CONTRACT_KIND.ORIGINAL,
    economics: {
      deliverableCount: 1,
      salePriceCentsPerContent: 100000,
      costCurrency: "USD",
      costMinorPerContent: 50000,
      costUsdCentsPerContent: 50000,
      fxUnitsPerUsd: 1,
      fxRateAt: new Date("2026-09-17T00:00:00.000Z"),
      fxSource: "FIXED",
      paymentTermDays: 0,
    },
    createdBy: "verificacion@local",
  });

  assert.equal(second.code, `CTR-${YEAR}-002`);
  ok(`el siguiente contrato es ${second.code}, sin colisionar con los anexos`);

  // --- PDF ---
  const originalPdfInput = await loadContractPdfInput(original.id);
  assert.ok(originalPdfInput);
  const first = await buildContractPdf(originalPdfInput);

  assert.ok(first.bytes.length > 1500, "el PDF tiene contenido");
  assert.equal(
    Buffer.from(first.bytes.slice(0, 5)).toString(),
    "%PDF-",
    "el fichero es un PDF"
  );
  ok(`el PDF del contrato se genera (${Math.round(first.bytes.length / 1024)} KB)`);

  const again = await buildContractPdf(originalPdfInput);
  assert.equal(
    first.sha256,
    again.sha256,
    "el PDF debe ser reproducible para que su huella sirva"
  );
  ok("regenerar el PDF da la misma huella SHA-256");

  const annexPdfInput = await loadContractPdfInput(annex.id);
  assert.ok(annexPdfInput);
  const annexPdf = await buildContractPdf(annexPdfInput);
  assert.notEqual(annexPdf.sha256, first.sha256);
  ok("el anexo genera un documento distinto del original");

  console.log(`\n${checks.length} comprobaciones correctas.`);
}

main()
  .catch((error) => {
    console.error("\nFALLO:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
