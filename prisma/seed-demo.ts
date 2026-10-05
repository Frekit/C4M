import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaClient } from "@prisma/client";

import { assertDemoSeedAllowed } from "../src/lib/demo-seed-guard";
import { postUrlKey } from "../src/lib/domain/post-url";
import { convertToUsdCents } from "../src/lib/money";

const DEMO_CAMPAIGNS = ["Navidad 2026", "Black Friday · Many Chat"] as const;
const DEMO_CODES = ["CTR-2026-001", "CTR-2026-002", "CTR-2026-004"] as const;
const DEMO_TOKEN = "demo-ctr-2026-004";
const DEMO_META = JSON.stringify({ source: "seed-demo" });

const HANDLES = [
  "martamoda",
  "lauratorres",
  "pabloframes",
  "sarabakes",
  "techconjavi",
  "nuriapixel",
  "diegoaudio",
  "inescocina",
  "sofianegro",
  "hugochat",
] as const;

function loadEnvFile() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // La shell ya puede haber exportado las variables.
  }
}

function utcDay(offset: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
}

function money(costMinor: number, currency: string, unitsPerUsd: number) {
  return convertToUsdCents(costMinor, currency, unitsPerUsd);
}

const prisma = new PrismaClient();

async function clearDemo() {
  await prisma.auditEvent.deleteMany({ where: { metadata: DEMO_META } });
  await prisma.signatureRequest.deleteMany({ where: { token: DEMO_TOKEN } });
  await prisma.contract.deleteMany({ where: { code: { in: [...DEMO_CODES] } } });
  await prisma.campaign.deleteMany({ where: { name: { in: [...DEMO_CAMPAIGNS] } } });
  await prisma.creator.deleteMany({ where: { handle: { in: [...HANDLES] } } });
}

type TalentInput = {
  handle: string;
  name: string;
  email: string | null;
  views: number;
  status: string;
  platform: string;
  format: string;
  count: number;
  costMinor: number;
  saleCents: number;
};

async function main() {
  loadEnvFile();
  assertDemoSeedAllowed(process.env);

  const adminEmail =
    process.env.BOOTSTRAP_ADMIN_EMAIL ?? "alvaroromero@creatorsformedia.com";
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    throw new Error("Falta el administrador. Ejecuta antes npm run db:seed.");
  }

  const higgsfield = await prisma.client.findUnique({ where: { name: "Higgsfield" } });
  const manyChat = await prisma.client.findUnique({ where: { name: "Many Chat" } });
  if (!higgsfield || !manyChat) {
    throw new Error("Faltan los clientes Higgsfield y Many Chat. Ejecuta antes npm run db:seed.");
  }

  const fx = await prisma.fxRate.findFirst({
    where: { currency: "EUR" },
    orderBy: { date: "desc" },
  });
  if (!fx) {
    throw new Error("Falta el tipo de cambio EUR. Ejecuta antes npm run db:seed.");
  }

  await clearDemo();

  const talents: TalentInput[] = [
    {
      handle: "martamoda",
      name: "Marta Molina",
      email: "marta.molina@ejemplo.test",
      views: 48200,
      status: "ACTIVE",
      platform: "INSTAGRAM",
      format: "REEL",
      count: 4,
      costMinor: 105_000,
      saleCents: 160_000,
    },
    {
      handle: "lauratorres",
      name: "Laura Torres",
      email: "laura.torres@ejemplo.test",
      views: 21500,
      status: "ACTIVE",
      platform: "INSTAGRAM",
      format: "REEL",
      count: 2,
      costMinor: 90_000,
      saleCents: 140_000,
    },
    {
      handle: "pabloframes",
      name: "Pablo Frames",
      email: "pablo.frames@ejemplo.test",
      views: 31000,
      status: "ACTIVE",
      platform: "TIKTOK",
      format: "VIDEO",
      count: 3,
      costMinor: 80_000,
      saleCents: 120_000,
    },
    {
      handle: "sarabakes",
      name: "Sara Blanco",
      email: "sara.blanco@ejemplo.test",
      views: 12800,
      status: "PROPOSED",
      platform: "INSTAGRAM",
      format: "REEL",
      count: 1,
      costMinor: 70_000,
      saleCents: 110_000,
    },
    {
      handle: "techconjavi",
      name: "Javier Ruiz",
      email: null,
      views: 9400,
      status: "PROPOSED",
      platform: "TIKTOK",
      format: "VIDEO",
      count: 1,
      costMinor: 60_000,
      saleCents: 95_000,
    },
    {
      handle: "nuriapixel",
      name: "Nuria Pixel",
      email: "nuria.pixel@ejemplo.test",
      views: 17300,
      status: "APPROVED",
      platform: "INSTAGRAM",
      format: "STORY",
      count: 3,
      costMinor: 45_000,
      saleCents: 75_000,
    },
    {
      handle: "diegoaudio",
      name: "Diego Audio",
      email: "diego.audio@ejemplo.test",
      views: 8600,
      status: "READY",
      platform: "INSTAGRAM",
      format: "REEL",
      count: 2,
      costMinor: 55_000,
      saleCents: 90_000,
    },
    {
      handle: "inescocina",
      name: "Inés Cocina",
      email: "ines.cocina@ejemplo.test",
      views: 6400,
      status: "REJECTED",
      platform: "INSTAGRAM",
      format: "REEL",
      count: 1,
      costMinor: 40_000,
      saleCents: 70_000,
    },
  ];

  const creators = new Map<string, { id: string }>();
  for (const talent of talents) {
    const creator = await prisma.creator.create({
      data: {
        handle: talent.handle,
        displayName: talent.name,
        instagramUrl: `https://instagram.com/${talent.handle}`,
        contactEmail: talent.email,
        country: "es",
        payoutCurrency: "EUR",
        igMedianViews: talent.views,
        igMedianViewsAt: utcDay(-4),
        notes: "Perfil de ejemplo. No es una persona real.",
        createdBy: admin.email,
      },
    });
    creators.set(talent.handle, creator);
  }

  const sofia = await prisma.creator.create({
    data: {
      handle: "sofianegro",
      displayName: "Sofía Negro",
      instagramUrl: "https://instagram.com/sofianegro",
      contactEmail: "sofia.negro@ejemplo.test",
      country: "es",
      payoutCurrency: "EUR",
      igMedianViews: 22000,
      igMedianViewsAt: utcDay(-6),
      notes: "Perfil de ejemplo. No es una persona real.",
      createdBy: admin.email,
    },
  });
  const hugo = await prisma.creator.create({
    data: {
      handle: "hugochat",
      displayName: "Hugo Chat",
      instagramUrl: "https://instagram.com/hugochat",
      contactEmail: "hugo.chat@ejemplo.test",
      country: "es",
      payoutCurrency: "EUR",
      igMedianViews: 5400,
      igMedianViewsAt: utcDay(-6),
      notes: "Perfil de ejemplo. No es una persona real.",
      createdBy: admin.email,
    },
  });

  const navidad = await prisma.campaign.create({
    data: {
      name: "Navidad 2026",
      clientId: higgsfield.id,
      status: "ACTIVE",
      engagementKind: "SLATE",
      approvalMode: "CLIENT_APPROVES",
      startsAt: new Date("2026-11-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T00:00:00.000Z"),
      description: "Campaña de ejemplo para el prototipo. No es un encargo real.",
      briefObjective: "Piezas de Navidad para Higgsfield. Datos ficticios.",
      createdBy: admin.email,
    },
  });

  const blackFriday = await prisma.campaign.create({
    data: {
      name: "Black Friday · Many Chat",
      clientId: manyChat.id,
      status: "ACTIVE",
      engagementKind: "SLATE",
      approvalMode: "INTERNAL",
      startsAt: new Date("2026-11-20T00:00:00.000Z"),
      endsAt: new Date("2026-11-30T00:00:00.000Z"),
      description: "Campaña de ejemplo para el prototipo. No es un encargo real.",
      createdBy: admin.email,
    },
  });

  for (const talent of talents) {
    const creator = creators.get(talent.handle);
    if (!creator) continue;
    await prisma.campaignTalent.create({
      data: {
        campaignId: navidad.id,
        creatorId: creator.id,
        status: talent.status,
        salePriceCentsPerContent: talent.saleCents,
        costMinorPerContent: talent.costMinor,
        costCurrency: "EUR",
        deliverableCount: talent.count,
        contentPlatform: talent.platform,
        contentFormat: talent.format,
        createdBy: admin.email,
      },
    });
  }

  await prisma.campaignTalent.create({
    data: {
      campaignId: blackFriday.id,
      creatorId: sofia.id,
      status: "ROSTER",
      contentPlatform: "INSTAGRAM",
      contentFormat: "REEL",
      deliverableCount: 2,
      costMinorPerContent: 50_000,
      costCurrency: "EUR",
      salePriceCentsPerContent: 80_000,
      createdBy: admin.email,
    },
  });
  await prisma.campaignTalent.create({
    data: {
      campaignId: blackFriday.id,
      creatorId: hugo.id,
      status: "PROPOSED",
      contentPlatform: "INSTAGRAM",
      contentFormat: "STORY",
      deliverableCount: 4,
      costMinorPerContent: 30_000,
      costCurrency: "EUR",
      salePriceCentsPerContent: 55_000,
      createdBy: admin.email,
    },
  });

  const units = fx.unitsPerUsd;
  const marta = talents[0];
  const laura = talents[1];
  const pablo = talents[2];
  if (!marta || !laura || !pablo) throw new Error("Faltan perfiles de ejemplo.");

  const contract001 = await prisma.contract.create({
    data: {
      code: "CTR-2026-001",
      creatorId: creators.get("martamoda")!.id,
      clientId: higgsfield.id,
      kind: "ORIGINAL",
      status: "SIGNED",
      deliverableCount: 34,
      salePriceCentsPerContent: marta.saleCents,
      costCurrency: "EUR",
      costMinorPerContent: marta.costMinor,
      fxUnitsPerUsd: units,
      fxRateAt: fx.date,
      fxSource: fx.source,
      costUsdCentsPerContent: money(marta.costMinor, "EUR", units),
      paymentTermDays: 30,
      startsAt: new Date("2026-11-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T00:00:00.000Z"),
      signedAt: utcDay(-12),
      notes: "Contrato de ejemplo. 34 contenidos para revisar la pantalla.",
      createdBy: admin.email,
    },
  });

  const contract002 = await prisma.contract.create({
    data: {
      code: "CTR-2026-002",
      creatorId: creators.get("pabloframes")!.id,
      clientId: higgsfield.id,
      kind: "ORIGINAL",
      status: "SIGNED",
      deliverableCount: 6,
      salePriceCentsPerContent: pablo.saleCents,
      costCurrency: "EUR",
      costMinorPerContent: pablo.costMinor,
      fxUnitsPerUsd: units,
      fxRateAt: fx.date,
      fxSource: fx.source,
      costUsdCentsPerContent: money(pablo.costMinor, "EUR", units),
      paymentTermDays: 30,
      startsAt: new Date("2026-11-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T00:00:00.000Z"),
      signedAt: utcDay(-8),
      notes: "Contrato de ejemplo.",
      createdBy: admin.email,
    },
  });

  const contract004 = await prisma.contract.create({
    data: {
      code: "CTR-2026-004",
      creatorId: creators.get("lauratorres")!.id,
      clientId: higgsfield.id,
      kind: "ORIGINAL",
      status: "SENT",
      deliverableCount: 2,
      salePriceCentsPerContent: laura.saleCents,
      costCurrency: "EUR",
      costMinorPerContent: laura.costMinor,
      fxUnitsPerUsd: units,
      fxRateAt: fx.date,
      fxSource: fx.source,
      costUsdCentsPerContent: money(laura.costMinor, "EUR", units),
      paymentTermDays: 30,
      startsAt: new Date("2026-11-01T00:00:00.000Z"),
      endsAt: new Date("2026-12-31T00:00:00.000Z"),
      notes: "Contrato de ejemplo, visto y sin firmar.",
      createdBy: admin.email,
    },
  });

  const rejectedUrl = "https://www.instagram.com/reel/DEMO2026NAVIDAD/";
  const deliverables: {
    contractId: string;
    position: number;
    title: string;
    status: string;
    scheduledFor?: Date;
    publishedAt?: Date;
    postUrl?: string;
    postUrlKey?: string;
    paymentDueAt?: Date;
    clientSubmittedAt?: Date;
    platformSubmitError?: string;
    platformSubmitErrorAt?: Date;
  }[] = [];

  for (let position = 1; position <= 34; position += 1) {
    const title = `Reel ${position}`;
    if (position === 1) {
      deliverables.push({
        contractId: contract001.id,
        position,
        title,
        status: "SCHEDULED",
        scheduledFor: utcDay(-3),
      });
    } else if (position >= 2 && position <= 6) {
      deliverables.push({
        contractId: contract001.id,
        position,
        title,
        status: "PUBLISHED",
        scheduledFor: utcDay(-6),
        publishedAt: utcDay(-5),
      });
    } else if (position === 7) {
      deliverables.push({
        contractId: contract001.id,
        position,
        title,
        status: "PUBLISHED",
        scheduledFor: utcDay(-6),
        publishedAt: utcDay(-4),
        postUrl: rejectedUrl,
        postUrlKey: postUrlKey(rejectedUrl) ?? rejectedUrl,
        platformSubmitError: "Higgsfield rechazó la subida: el enlace no coincide con la pieza.",
        platformSubmitErrorAt: utcDay(-1),
      });
    } else if (position >= 8 && position <= 12) {
      deliverables.push({
        contractId: contract001.id,
        position,
        title,
        status: "SUBMITTED",
        scheduledFor: utcDay(-10),
        publishedAt: utcDay(-8),
        clientSubmittedAt: utcDay(-3),
        paymentDueAt: utcDay(-1),
      });
    } else if (position >= 13 && position <= 16) {
      deliverables.push({
        contractId: contract001.id,
        position,
        title,
        status: "SCHEDULED",
        scheduledFor: utcDay(position - 12),
      });
    } else if (position <= 28) {
      deliverables.push({
        contractId: contract001.id,
        position,
        title,
        status: "SCHEDULED",
        scheduledFor: utcDay(10 + position),
      });
    } else {
      deliverables.push({
        contractId: contract001.id,
        position,
        title,
        status: "PENDING",
      });
    }
  }

  deliverables.push(
    {
      contractId: contract002.id,
      position: 1,
      title: "Vídeo 1",
      status: "SCHEDULED",
      scheduledFor: utcDay(-3),
    },
    {
      contractId: contract002.id,
      position: 2,
      title: "Vídeo 2",
      status: "SUBMITTED",
      scheduledFor: utcDay(-9),
      publishedAt: utcDay(-7),
      clientSubmittedAt: utcDay(-2),
      paymentDueAt: utcDay(-1),
    },
    {
      contractId: contract002.id,
      position: 3,
      title: "Vídeo 3",
      status: "SUBMITTED",
      scheduledFor: utcDay(-9),
      publishedAt: utcDay(-7),
      clientSubmittedAt: utcDay(-2),
      paymentDueAt: utcDay(-1),
    },
    {
      contractId: contract002.id,
      position: 4,
      title: "Vídeo 4",
      status: "SCHEDULED",
      scheduledFor: utcDay(2),
    },
    {
      contractId: contract004.id,
      position: 1,
      title: "Reel 1",
      status: "SCHEDULED",
      scheduledFor: utcDay(-3),
    },
    {
      contractId: contract004.id,
      position: 2,
      title: "Reel 2",
      status: "SCHEDULED",
      scheduledFor: utcDay(3),
    }
  );

  await prisma.deliverable.createMany({
    data: deliverables.map((item) => ({
      ...item,
      campaignId: navidad.id,
    })),
  });

  await prisma.signatureRequest.create({
    data: {
      contractId: contract004.id,
      token: DEMO_TOKEN,
      recipientEmail: "laura.torres@ejemplo.test",
      recipientKind: "TALENT",
      status: "VIEWED",
      expiresAt: utcDay(2),
      sentAt: utcDay(-2),
      viewedAt: utcDay(-1),
      createdBy: admin.email,
    },
  });

  await prisma.campaignMessage.create({
    data: {
      campaignId: navidad.id,
      authorKind: "CLIENT",
      authorLabel: "Higgsfield",
      body: "¿Podemos mover los reels que iban el 2 de octubre? El resto del calendario de Navidad sigue en pie.",
      visibility: "SHARED",
      createdAt: utcDay(-1),
    },
  });

  await prisma.auditEvent.createMany({
    data: [
      {
        entityType: "contrato",
        entityId: contract001.id,
        action: "marcó el contrato como firmado",
        actorEmail: admin.email,
        actorRole: admin.role,
        metadata: DEMO_META,
        createdAt: utcDay(-12),
      },
      {
        entityType: "contenido",
        entityId: contract001.id,
        action: "publicó 5 contenidos sin enlace",
        actorEmail: admin.email,
        actorRole: admin.role,
        metadata: DEMO_META,
        createdAt: utcDay(-5),
      },
      {
        entityType: "firma",
        entityId: contract004.id,
        action: "abrió el enlace y no firmó",
        actorEmail: "laura.torres@ejemplo.test",
        metadata: DEMO_META,
        createdAt: utcDay(-1),
      },
      {
        entityType: "campaña",
        entityId: navidad.id,
        action: "escribió en el hilo",
        actorEmail: "cliente@higgsfield.ejemplo.test",
        metadata: DEMO_META,
        createdAt: utcDay(-1),
      },
    ],
  });

  console.log("Datos de ejemplo listos. No son personas ni campañas reales.");
  console.log("Campaña: Navidad 2026");
  console.log("Campaña: Black Friday · Many Chat");
  console.log("Contratos: CTR-2026-001 (34 contenidos), CTR-2026-002, CTR-2026-004");
  console.log(`Firma de ejemplo: /firmar/${DEMO_TOKEN}`);
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("seed-demo.ts") || entry.endsWith("seed-demo.js")) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
