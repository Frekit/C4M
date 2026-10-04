import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Primer administrador: no se puede invitar a sí mismo, así que entra por aquí.
const BOOTSTRAP_ADMIN_EMAIL =
  process.env.BOOTSTRAP_ADMIN_EMAIL ?? "alvaroromero@creatorsformedia.com";
const BOOTSTRAP_ADMIN_NAME = process.env.BOOTSTRAP_ADMIN_NAME ?? "Álvaro Romero";

// Cambios de referencia para poder calcular márgenes desde el primer día.
// Cuando entre el job diario contra una API de FX, esto deja de hacer falta.
const FX_SEED: { currency: string; unitsPerUsd: number }[] = [
  { currency: "EUR", unitsPerUsd: 0.92 },
  { currency: "GBP", unitsPerUsd: 0.79 },
  { currency: "MXN", unitsPerUsd: 17.1 },
  { currency: "COP", unitsPerUsd: 3900 },
  { currency: "BRL", unitsPerUsd: 5.4 },
  { currency: "ARS", unitsPerUsd: 950 },
  { currency: "CLP", unitsPerUsd: 940 },
  { currency: "PEN", unitsPerUsd: 3.75 },
  { currency: "DOP", unitsPerUsd: 59 },
];

function startOfUtcDay(date = new Date()) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

async function main() {
  const { getRuntimeEnv } = await import("../src/lib/runtime-env");
  const runtime = getRuntimeEnv();
  if (!runtime.allowSeed) {
    throw new Error(
      "La semilla no corre en producción. Si de verdad hace falta, ALLOW_PROD_SEED=1."
    );
  }

  const admin = await prisma.user.upsert({
    where: { email: BOOTSTRAP_ADMIN_EMAIL },
    create: {
      email: BOOTSTRAP_ADMIN_EMAIL,
      name: BOOTSTRAP_ADMIN_NAME,
      role: "ADMIN",
      status: "ACTIVE",
    },
    update: { role: "ADMIN", status: "ACTIVE" },
  });

  const date = startOfUtcDay();

  for (const rate of FX_SEED) {
    await prisma.fxRate.upsert({
      where: { currency_date: { currency: rate.currency, date } },
      create: { ...rate, date, source: "SEED" },
      update: { unitsPerUsd: rate.unitsPerUsd, source: "SEED" },
    });
  }

  console.log(`Administrador listo: ${admin.email}`);
  console.log(`Tipos de cambio cargados: ${FX_SEED.length}`);

  const higgsfield = await prisma.client.upsert({
    where: { name: "Higgsfield" },
    create: {
      name: "Higgsfield",
      settlementMode: "PER_CONTENT",
      requiresPlatformSubmit: true,
      notes: "Cada contenido se sube a su plataforma y se liquida por pieza.",
    },
    update: {
      settlementMode: "PER_CONTENT",
      requiresPlatformSubmit: true,
    },
  });

  const manyChat = await prisma.client.upsert({
    where: { name: "Many Chat" },
    create: {
      name: "Many Chat",
      settlementMode: "PACK",
      requiresPlatformSubmit: false,
      notes: "No se cobra ni se paga hasta que el perfil termina el pack de la campaña.",
    },
    update: {
      settlementMode: "PACK",
      requiresPlatformSubmit: false,
    },
  });

  await prisma.campaign.updateMany({
    where: { name: "GPT ASTRA 6", clientId: null },
    data: { clientId: higgsfield.id },
  });

  console.log(`Clientes listos: ${higgsfield.name}, ${manyChat.name}`);

  const { ensureRosterCatalog, remapCreatorCatalogValues } = await import(
    "../src/lib/domain/roster-catalog"
  );
  await ensureRosterCatalog();
  await remapCreatorCatalogValues();
  console.log("Catálogo de países y tipos de perfil listo.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
