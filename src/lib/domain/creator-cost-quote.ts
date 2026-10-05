import { isSupportedCurrency } from "@/lib/currencies";
import { parseAmountToMinorUnits } from "@/lib/money";

export const COST_PLATFORM = {
  INSTAGRAM: "INSTAGRAM",
  TIKTOK: "TIKTOK",
  LINKEDIN: "LINKEDIN",
  X: "X",
} as const;

export type CostPlatform = (typeof COST_PLATFORM)[keyof typeof COST_PLATFORM];

export const COST_PLATFORM_LABELS: Record<CostPlatform, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  X: "X",
};

const PLATFORM_ORDER: Record<CostPlatform, number> = {
  INSTAGRAM: 0,
  TIKTOK: 1,
  LINKEDIN: 2,
  X: 3,
};

type FormatSpec = {
  label: string;
  one: string;
  many: string;
};

const PLATFORM_FORMATS: Record<CostPlatform, Record<string, FormatSpec>> = {
  INSTAGRAM: {
    REEL: { label: "Reel", one: "reel", many: "reels" },
    STORY: { label: "Story", one: "story", many: "stories" },
    CAROUSEL: { label: "Carrusel", one: "carrusel", many: "carruseles" },
  },
  TIKTOK: {
    VIDEO: { label: "Vídeo", one: "vídeo", many: "vídeos" },
    PHOTO: { label: "Foto", one: "foto", many: "fotos" },
  },
  LINKEDIN: {
    POST: { label: "Post", one: "post", many: "posts" },
    VIDEO: { label: "Vídeo", one: "vídeo", many: "vídeos" },
    CAROUSEL: { label: "Carrusel", one: "carrusel", many: "carruseles" },
  },
  X: {
    POST: { label: "Post", one: "post", many: "posts" },
    THREAD: { label: "Hilo", one: "hilo", many: "hilos" },
  },
};

export const IG_COST_FORMAT = {
  REEL: "REEL",
  STORY: "STORY",
  CAROUSEL: "CAROUSEL",
} as const;

export type IgCostFormat = (typeof IG_COST_FORMAT)[keyof typeof IG_COST_FORMAT];

export const IG_COST_FORMAT_LABELS: Record<IgCostFormat, string> = {
  REEL: "Reel",
  STORY: "Story",
  CAROUSEL: "Carrusel",
};

export function isCostPlatform(value: string): value is CostPlatform {
  return Object.values(COST_PLATFORM).includes(value as CostPlatform);
}

export function isIgCostFormat(value: string): value is IgCostFormat {
  return Object.values(IG_COST_FORMAT).includes(value as IgCostFormat);
}

export function formatsForPlatform(platform: CostPlatform) {
  return Object.entries(PLATFORM_FORMATS[platform]).map(([code, spec]) => ({
    code,
    label: spec.label,
  }));
}

export function isCostFormat(platform: string, format: string): boolean {
  if (!isCostPlatform(platform)) return false;
  return Object.prototype.hasOwnProperty.call(PLATFORM_FORMATS[platform], format);
}

export function costPackageLabel(
  platform: CostPlatform,
  format: string,
  quantity: number
) {
  const spec = PLATFORM_FORMATS[platform][format];
  if (!spec) return `${quantity} ${format}`;
  return `${quantity} ${quantity === 1 ? spec.one : spec.many}`;
}

export function quotePackageText(
  platform: string | null | undefined,
  format: string | null | undefined,
  quantity: number
) {
  const resolved =
    platform && isCostPlatform(platform)
      ? platform
      : format && isIgCostFormat(format)
        ? COST_PLATFORM.INSTAGRAM
        : null;
  if (!resolved || !format || !isCostFormat(resolved, format)) return null;
  return `${COST_PLATFORM_LABELS[resolved]} · ${costPackageLabel(resolved, format, quantity)}`;
}

export function sortCostQuotes<
  T extends { platform?: string; format: string; quantity: number },
>(quotes: T[]): T[] {
  return [...quotes].sort((a, b) => {
    const platformA =
      a.platform && isCostPlatform(a.platform) ? PLATFORM_ORDER[a.platform] : 0;
    const platformB =
      b.platform && isCostPlatform(b.platform) ? PLATFORM_ORDER[b.platform] : 0;
    if (platformA !== platformB) return platformA - platformB;
    const formatsA = a.platform && isCostPlatform(a.platform)
      ? Object.keys(PLATFORM_FORMATS[a.platform])
      : Object.keys(PLATFORM_FORMATS.INSTAGRAM);
    const formatsB = b.platform && isCostPlatform(b.platform)
      ? Object.keys(PLATFORM_FORMATS[b.platform])
      : Object.keys(PLATFORM_FORMATS.INSTAGRAM);
    const formatDelta =
      (formatsA.indexOf(a.format) === -1 ? 9 : formatsA.indexOf(a.format)) -
      (formatsB.indexOf(b.format) === -1 ? 9 : formatsB.indexOf(b.format));
    if (formatDelta !== 0) return formatDelta;
    return a.quantity - b.quantity;
  });
}

export function perContentFromPackage(totalMinor: number, quantity: number) {
  if (!Number.isInteger(totalMinor) || totalMinor <= 0) {
    return { ok: false as const, error: "Revisa el coste del paquete." };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false as const, error: "Pon cuántos contenidos lleva el paquete." };
  }
  if (totalMinor % quantity !== 0) {
    return {
      ok: false as const,
      error:
        "Ese paquete no parte en un coste exacto por pieza. Ajusta el total o la cantidad.",
    };
  }
  return { ok: true as const, perContentMinor: totalMinor / quantity };
}

export function parseCostQuoteInput(input: {
  platform?: string;
  format: string;
  quantity: string;
  amount: string;
  currency: string;
}):
  | {
      ok: true;
      platform: CostPlatform;
      format: string;
      quantity: number;
      costMinor: number;
      currency: string;
    }
  | { ok: false; error: string } {
  const platform = (input.platform ?? COST_PLATFORM.INSTAGRAM).trim().toUpperCase();
  if (!isCostPlatform(platform)) {
    return { ok: false, error: "Elige Instagram, TikTok, LinkedIn o X." };
  }
  if (!isCostFormat(platform, input.format)) {
    return { ok: false, error: "Ese formato no existe en esa red." };
  }

  const quantity = Number.parseInt(input.quantity.trim(), 10);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return { ok: false, error: "La cantidad tiene que estar entre 1 y 99." };
  }

  const currency = input.currency.trim().toUpperCase();
  if (!isSupportedCurrency(currency)) {
    return { ok: false, error: `Moneda ${currency} no soportada.` };
  }

  const costMinor = parseAmountToMinorUnits(input.amount, currency);
  if (costMinor === null || costMinor <= 0) {
    return { ok: false, error: "Revisa el coste del paquete." };
  }

  return { ok: true, platform, format: input.format, quantity, costMinor, currency };
}
