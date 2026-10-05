export const MEDIAN_VIEWS_REFRESH_DAYS = 15;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MEDIAN_VIEWS = 2_000_000_000;

const viewsFormatter = new Intl.NumberFormat("es-ES");

export function formatMedianViews(views: number): string {
  return viewsFormatter.format(views);
}

export function parseMedianViews(
  raw: string
): { ok: true; views: number } | { ok: false; error: string } {
  const compact = raw.trim().replace(/\s+/g, "");
  if (!compact) {
    return { ok: false, error: "Pon la mediana de views de Instagram." };
  }

  let digits = compact;
  if (/^\d{1,3}(\.\d{3})+$/.test(compact) || /^\d{1,3}(,\d{3})+$/.test(compact)) {
    digits = compact.replace(/[.,]/g, "");
  } else if (!/^\d+$/.test(compact)) {
    return {
      ok: false,
      error: "La mediana de views es un número entero (por ejemplo 12.500).",
    };
  }

  const views = Number(digits);
  if (!Number.isSafeInteger(views) || views > MAX_MEDIAN_VIEWS) {
    return { ok: false, error: "Esa mediana de views es demasiado alta." };
  }

  return { ok: true, views };
}

export function medianViewsDueAt(recordedAt: Date): Date {
  return new Date(recordedAt.getTime() + MEDIAN_VIEWS_REFRESH_DAYS * DAY_MS);
}

export function medianViewsCutoff(now = new Date()): Date {
  return new Date(now.getTime() - MEDIAN_VIEWS_REFRESH_DAYS * DAY_MS);
}

export function isMedianViewsStale(input: {
  views: number | null;
  recordedAt: Date | null;
  now?: Date;
}): boolean {
  if (input.views == null || input.recordedAt == null) return true;
  const now = input.now ?? new Date();
  return now.getTime() >= medianViewsDueAt(input.recordedAt).getTime();
}

export function staleMedianViewsWhere(now = new Date()) {
  const cutoff = medianViewsCutoff(now);
  return {
    OR: [
      { igMedianViews: null },
      { igMedianViewsAt: null },
      { igMedianViewsAt: { lte: cutoff } },
    ],
  };
}
