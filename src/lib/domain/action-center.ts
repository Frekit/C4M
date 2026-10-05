import { prisma } from "@/lib/db";
import {
  CONTRACT_STATUS,
  DELIVERABLE_STATUS,
  SIGNATURE_STATUS,
} from "@/lib/domain/enums";
import { formatMoney } from "@/lib/money";

export type ActionTone = "danger" | "warning" | "info";
export type ActionKind = "firma" | "contenido" | "pago" | "mensaje";

export type ActionOption = {
  key: "A" | "B" | "C";
  label: string;
  hint?: string;
  kind: "move-date" | "href" | "assistant";
  href?: string;
  deliverableIds?: string[];
  dateValue?: string;
  dateLabel?: string;
};

export type ActionCard = {
  id: string;
  tone: ActionTone;
  kind: ActionKind;
  title: string;
  body: string;
  meta?: string;
  href?: string;
  campaignId?: string;
  campaignName?: string;
  age: string;
  handles: string[];
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  options?: ActionOption[];
};

export type WeekItem = {
  id: string;
  day: string;
  label: string;
  href: string;
};

export type ActivityItem = {
  id: string;
  label: string;
  when: string;
};

export type ActionCenter = {
  greeting: string;
  eyebrow: string;
  firstName: string;
  empty: "first-use" | "clear" | null;
  urgentCount: number;
  cards: ActionCard[];
  kpis: {
    signing: number;
    signingHint: string;
    thisWeek: number;
    thisWeekHint: string;
    late: number;
    payoutLabel: string;
  };
  week: WeekItem[];
  activity: ActivityItem[];
};

const TONE_RANK: Record<ActionTone, number> = { danger: 0, warning: 1, info: 2 };

function madridParts(now: Date) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Madrid",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now)
  );
  return { date, hour, start: new Date(`${date}T00:00:00.000Z`) };
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function nextThursday(start: Date) {
  const day = start.getUTCDay();
  const delta = (4 - day + 7) % 7 || 7;
  return addDays(start, delta);
}

function initials(handle: string) {
  return handle.replace(/^@/, "").slice(0, 2).toUpperCase();
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export async function loadActionCenter(
  firstName: string,
  now = new Date()
): Promise<ActionCenter> {
  const { date, hour, start } = madridParts(now);
  const weekEnd = addDays(start, 7);
  const thursday = nextThursday(start);
  const thursdayValue = thursday.toISOString().slice(0, 10);
  const thursdayLabel = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(thursday);
  const hello = hour < 12 ? "Buenos días" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const eyebrow = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  })
    .format(now)
    .toUpperCase();

  const campaignCount = await prisma.campaign.count();
  if (campaignCount === 0) {
    return {
      greeting: hello,
      eyebrow,
      firstName,
      empty: "first-use",
      urgentCount: 0,
      cards: [],
      kpis: {
        signing: 0,
        signingHint: "Sin envíos",
        thisWeek: 0,
        thisWeekHint: "Nada programado",
        late: 0,
        payoutLabel: formatMoney(0, "EUR"),
      },
      week: [],
      activity: [],
    };
  }

  const openContract = { status: { not: CONTRACT_STATUS.CANCELLED } };
  const notLive = {
    status: { in: [DELIVERABLE_STATUS.PENDING, DELIVERABLE_STATUS.SCHEDULED] },
  };

  const [
    expired,
    unsigned,
    viewed,
    late,
    missing,
    payout,
    platformErrors,
    clientMessages,
    signingCount,
    soonestExpiry,
    weekItems,
    weekCount,
    activity,
  ] = await Promise.all([
    prisma.signatureRequest.findMany({
      where: {
        status: { in: [SIGNATURE_STATUS.PENDING, SIGNATURE_STATUS.VIEWED] },
        expiresAt: { lt: now },
        contract: { status: { in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT] } },
      },
      orderBy: { expiresAt: "asc" },
      take: 8,
      select: {
        id: true,
        expiresAt: true,
        contract: {
          select: {
            id: true,
            code: true,
            creator: { select: { handle: true } },
            deliverables: { select: { campaign: { select: { id: true, name: true } } }, take: 1 },
          },
        },
      },
    }),
    prisma.contract.findMany({
      where: {
        status: { in: [CONTRACT_STATUS.DRAFT, CONTRACT_STATUS.SENT] },
        deliverables: {
          some: { status: { in: [DELIVERABLE_STATUS.PUBLISHED, DELIVERABLE_STATUS.SUBMITTED] } },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: {
        id: true,
        code: true,
        updatedAt: true,
        creator: { select: { handle: true } },
        _count: {
          select: {
            deliverables: {
              where: { status: { in: [DELIVERABLE_STATUS.PUBLISHED, DELIVERABLE_STATUS.SUBMITTED] } },
            },
          },
        },
      },
    }),
    prisma.signatureRequest.findMany({
      where: {
        status: SIGNATURE_STATUS.VIEWED,
        expiresAt: { gte: now },
        contract: { status: CONTRACT_STATUS.SENT },
      },
      orderBy: { expiresAt: "asc" },
      take: 8,
      select: {
        id: true,
        token: true,
        expiresAt: true,
        viewedAt: true,
        contract: {
          select: { id: true, code: true, creator: { select: { handle: true, displayName: true } } },
        },
      },
    }),
    prisma.deliverable.findMany({
      where: {
        ...notLive,
        scheduledFor: { lt: start },
        contract: openContract,
      },
      orderBy: { scheduledFor: "asc" },
      take: 40,
      select: {
        id: true,
        title: true,
        scheduledFor: true,
        campaign: { select: { id: true, name: true, client: { select: { name: true } } } },
        contract: { select: { creator: { select: { handle: true } } } },
      },
    }),
    prisma.deliverable.findMany({
      where: {
        status: DELIVERABLE_STATUS.PUBLISHED,
        postUrl: null,
        contract: openContract,
      },
      orderBy: { publishedAt: "asc" },
      take: 40,
      select: {
        id: true,
        publishedAt: true,
        campaign: { select: { id: true, name: true } },
        contract: { select: { creator: { select: { handle: true } } } },
      },
    }),
    prisma.deliverable.findMany({
      where: {
        status: DELIVERABLE_STATUS.SUBMITTED,
        paidAt: null,
        paymentDueAt: { lte: now },
        contract: openContract,
      },
      orderBy: { paymentDueAt: "asc" },
      take: 80,
      select: {
        id: true,
        paymentDueAt: true,
        contract: {
          select: {
            costMinorPerContent: true,
            costCurrency: true,
            creatorId: true,
          },
        },
      },
    }),
    prisma.deliverable.findMany({
      where: { platformSubmitError: { not: null }, contract: openContract },
      orderBy: { platformSubmitErrorAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        platformSubmitError: true,
        platformSubmitErrorAt: true,
        contract: { select: { code: true, creator: { select: { handle: true } } } },
      },
    }),
    prisma.campaignMessage.findMany({
      where: { authorKind: "CLIENT" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        body: true,
        createdAt: true,
        authorLabel: true,
        campaign: { select: { id: true, name: true } },
      },
    }),
    prisma.contract.count({ where: { status: CONTRACT_STATUS.SENT } }),
    prisma.signatureRequest.findFirst({
      where: {
        status: { in: [SIGNATURE_STATUS.PENDING, SIGNATURE_STATUS.VIEWED] },
        contract: { status: CONTRACT_STATUS.SENT },
      },
      orderBy: { expiresAt: "asc" },
      select: { expiresAt: true },
    }),
    prisma.deliverable.findMany({
      where: {
        scheduledFor: { gte: start, lt: weekEnd },
        status: { in: [DELIVERABLE_STATUS.PENDING, DELIVERABLE_STATUS.SCHEDULED] },
        contract: openContract,
      },
      orderBy: { scheduledFor: "asc" },
      take: 12,
      select: {
        id: true,
        title: true,
        scheduledFor: true,
        contract: { select: { creator: { select: { handle: true } } } },
      },
    }),
    prisma.deliverable.count({
      where: {
        scheduledFor: { gte: start, lt: weekEnd },
        contract: openContract,
      },
    }),
    prisma.auditEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, action: true, actorEmail: true, createdAt: true, entityType: true },
    }),
  ]);

  const cards: ActionCard[] = [];

  const lateByCampaign = new Map<string, typeof late>();
  for (const item of late) {
    const key = item.campaign?.id ?? "sin-campana";
    const list = lateByCampaign.get(key) ?? [];
    list.push(item);
    lateByCampaign.set(key, list);
  }
  for (const [key, items] of lateByCampaign) {
    const campaign = items[0]?.campaign;
    const handles = [...new Set(items.map((item) => item.contract.creator.handle))];
    cards.push({
      id: `late-${key}`,
      tone: "danger",
      kind: "contenido",
      title: campaign?.name ?? "Sin campaña",
      body: `${items.length} ${items.length === 1 ? "contenido tenía fecha" : "contenidos tenían fecha"} y siguen sin publicar`,
      meta: campaign?.client?.name,
      campaignId: campaign?.id,
      campaignName: campaign?.name,
      href: campaign ? `/campanas/${campaign.id}` : "/contenidos",
      age: items[0]?.scheduledFor?.toISOString() ?? now.toISOString(),
      handles,
      options: [
        {
          key: "A",
          label: `Mover la fecha al ${thursdayLabel}`,
          hint: "Pide confirmación antes de guardar",
          kind: "move-date",
          deliverableIds: items.map((item) => item.id),
          dateValue: thursdayValue,
          dateLabel: thursdayLabel,
        },
        {
          key: "B",
          label: "Ya están publicados: añadir los enlaces",
          kind: "href",
          href: "/contenidos?sinEnlace=1",
        },
        {
          key: "C",
          label: "Pedir otra cosa al asistente…",
          kind: "assistant",
        },
      ],
    });
  }

  for (const request of expired) {
    cards.push({
      id: `expired-${request.id}`,
      tone: "danger",
      kind: "firma",
      title: `${request.contract.code} · firma caducada`,
      body: `@${request.contract.creator.handle} no firmó antes de que caducara el enlace.`,
      href: `/contratos/${request.contract.id}`,
      age: request.expiresAt.toISOString(),
      handles: [request.contract.creator.handle],
      primary: { label: "Abrir contrato", href: `/contratos/${request.contract.id}` },
    });
  }

  for (const item of platformErrors) {
    cards.push({
      id: `platform-${item.id}`,
      tone: "danger",
      kind: "contenido",
      title: `${item.contract.code} · rechazado por plataforma`,
      body: item.platformSubmitError ?? "La plataforma rechazó la subida.",
      href: `/contenidos`,
      age: (item.platformSubmitErrorAt ?? now).toISOString(),
      handles: [item.contract.creator.handle],
      primary: { label: "Revisar enlace", href: "/contenidos?errorPlataforma=1" },
    });
  }

  for (const request of viewed) {
    const name = request.contract.creator.displayName || `@${request.contract.creator.handle}`;
    cards.push({
      id: `viewed-${request.id}`,
      tone: "warning",
      kind: "firma",
      title: `${request.contract.code} · visto, sin firmar`,
      body: `${name} abrió el enlace pero no ha firmado.`,
      href: `/contratos/${request.contract.id}`,
      age: (request.viewedAt ?? request.expiresAt).toISOString(),
      handles: [request.contract.creator.handle],
      primary: { label: "Reenviar", href: `/contratos/${request.contract.id}` },
      secondary: { label: "Copiar enlace", href: `/contratos/${request.contract.id}` },
    });
  }

  if (missing.length > 0) {
    const handles = [...new Set(missing.map((item) => item.contract.creator.handle))];
    cards.push({
      id: "missing-links",
      tone: "warning",
      kind: "contenido",
      title: `${missing.length} contenidos publicados sin enlace`,
      body: handles.slice(0, 4).map((handle) => `@${handle}`).join(", "),
      href: "/contenidos?sinEnlace=1",
      age: (missing[0]?.publishedAt ?? now).toISOString(),
      handles,
      primary: { label: "Añadir enlaces", href: "/contenidos?sinEnlace=1" },
    });
  }

  for (const contract of unsigned) {
    cards.push({
      id: `unsigned-${contract.id}`,
      tone: "warning",
      kind: "firma",
      title: `${contract.code} · publicado sin firmar`,
      body: `@${contract.creator.handle} tiene ${contract._count.deliverables} contenidos publicados y el contrato sigue sin firma.`,
      href: `/contratos/${contract.id}`,
      age: contract.updatedAt.toISOString(),
      handles: [contract.creator.handle],
      primary: { label: "Abrir contrato", href: `/contratos/${contract.id}` },
    });
  }

  if (payout.length > 0) {
    const byCurrency = new Map<string, number>();
    const creators = new Set<string>();
    for (const item of payout) {
      creators.add(item.contract.creatorId);
      const currency = item.contract.costCurrency;
      byCurrency.set(
        currency,
        (byCurrency.get(currency) ?? 0) + item.contract.costMinorPerContent
      );
    }
    const [currency, amount] = [...byCurrency.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["EUR", 0];
    cards.push({
      id: "payout-ready",
      tone: "info",
      kind: "pago",
      title: `Lote de pago listo: ${creators.size} creators · ${formatMoney(amount, currency)}`,
      body: "Contenidos subidos al cliente con el pago vencido y todavía sin pagar.",
      href: "/finanzas",
      age: (payout[0]?.paymentDueAt ?? now).toISOString(),
      handles: [],
      primary: { label: "Ver detalle", href: "/finanzas" },
    });
  }

  for (const message of clientMessages) {
    cards.push({
      id: `msg-${message.id}`,
      tone: "info",
      kind: "mensaje",
      title: `${message.campaign.name} · mensaje del cliente`,
      body: message.body.length > 140 ? `${message.body.slice(0, 140)}…` : message.body,
      meta: message.authorLabel,
      href: `/campanas/${message.campaign.id}`,
      campaignId: message.campaign.id,
      age: message.createdAt.toISOString(),
      handles: [],
      primary: { label: "Abrir hilo", href: `/campanas/${message.campaign.id}?vista=hilo` },
    });
  }

  cards.sort((a, b) => {
    const tone = TONE_RANK[a.tone] - TONE_RANK[b.tone];
    if (tone !== 0) return tone;
    return a.age < b.age ? -1 : 1;
  });

  if (cards[0] && !cards[0].options) {
    const first = cards[0];
    first.options = [
      {
        key: "A",
        label: first.primary?.label ?? "Abrir",
        kind: "href",
        href: first.primary?.href ?? first.href ?? "/",
      },
      {
        key: "B",
        label: "Ver en contenidos",
        kind: "href",
        href: "/contenidos",
      },
      { key: "C", label: "Pedir otra cosa al asistente…", kind: "assistant" },
    ];
  }
  for (const card of cards.slice(1)) {
    card.options = undefined;
  }

  const daysLeft = soonestExpiry
    ? Math.ceil((soonestExpiry.expiresAt.getTime() - now.getTime()) / 86400000)
    : null;
  const scheduled = weekItems.filter((item) => item.scheduledFor).length;

  return {
    greeting: hello,
    eyebrow,
    firstName,
    empty: cards.length === 0 ? "clear" : null,
    urgentCount: cards.length,
    cards,
    kpis: {
      signing: signingCount,
      signingHint: daysLeft == null ? "Sin caducidad próxima" : daysLeft < 0 ? "Hay un enlace caducado" : `1 caduca en ${daysLeft} d`,
      thisWeek: weekCount,
      thisWeekHint: `${scheduled} prog. · ${Math.max(weekCount - scheduled, 0)} en la semana`,
      late: late.length,
      payoutLabel: cards.find((card) => card.id === "payout-ready")
        ? cards.find((card) => card.id === "payout-ready")!.title.replace("Lote de pago listo: ", "").split(" · ").at(-1) ?? formatMoney(0, "EUR")
        : formatMoney(0, "EUR"),
    },
    week: weekItems.map((item) => ({
      id: item.id,
      day: item.scheduledFor ? dayLabel(item.scheduledFor) : date,
      label: `${item.title?.trim() || "Contenido"} · @${item.contract.creator.handle}`,
      href: "/contenidos",
    })),
    activity: activity.map((event) => ({
      id: event.id,
      label: `${event.actorEmail ?? "Alguien"} · ${event.action} · ${event.entityType}`,
      when: event.createdAt.toISOString(),
    })),
  };
}

export function handleInitials(handle: string) {
  return initials(handle);
}
