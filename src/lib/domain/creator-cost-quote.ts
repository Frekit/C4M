import { isSupportedCurrency } from "@/lib/currencies";
import { parseAmountToMinorUnits } from "@/lib/money";

export const COST_PLATFORM = {
  INSTAGRAM: "INSTAGRAM",
} as const;

export type CostPlatform = (typeof COST_PLATFORM)[keyof typeof COST_PLATFORM];

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

const PACKAGE_WORDS: Record<IgCostFormat, [string, string]> = {
  REEL: ["reel", "reels"],
  STORY: ["story", "stories"],
  CAROUSEL: ["carrusel", "carruseles"],
};

export const IG_COST_FORMAT_ORDER: Record<IgCostFormat, number> = {
  REEL: 0,
  STORY: 1,
  CAROUSEL: 2,
};

export function isIgCostFormat(value: string): value is IgCostFormat {
  return Object.values(IG_COST_FORMAT).includes(value as IgCostFormat);
}

export function costPackageLabel(format: IgCostFormat, quantity: number) {
  const [one, many] = PACKAGE_WORDS[format];
  return `${quantity} ${quantity === 1 ? one : many}`;
}

export function sortCostQuotes<
  T extends { format: string; quantity: number },
>(quotes: T[]): T[] {
  return [...quotes].sort((a, b) => {
    const formatDelta =
      (isIgCostFormat(a.format) ? IG_COST_FORMAT_ORDER[a.format] : 9) -
      (isIgCostFormat(b.format) ? IG_COST_FORMAT_ORDER[b.format] : 9);
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
  format: string;
  quantity: string;
  amount: string;
  currency: string;
}):
  | {
      ok: true;
      format: IgCostFormat;
      quantity: number;
      costMinor: number;
      currency: string;
    }
  | { ok: false; error: string } {
  if (!isIgCostFormat(input.format)) {
    return { ok: false, error: "Elige reel, story o carrusel." };
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

  return { ok: true, format: input.format, quantity, costMinor, currency };
}
