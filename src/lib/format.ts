const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

export function toInputDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function daysUntil(value: Date | string): number {
  const target = new Date(value).getTime();
  const today = Date.now();
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export function relativeDueLabel(value: Date | string | null | undefined): string {
  if (!value) return "—";

  const days = daysUntil(value);
  if (days === 0) return "hoy";
  if (days < 0) return `vencido hace ${Math.abs(days)} d.`;
  return `en ${days} d.`;
}
