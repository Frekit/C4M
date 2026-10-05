// Los importes viajan y se guardan siempre en unidades mínimas (Int).
// El número de decimales depende de la moneda: JPY no tiene céntimos, CLP tampoco.

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "ISK",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "OMR", "TND"]);

export function currencyDecimals(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

export function toMinorUnits(amount: number, currency: string): number {
  const factor = 10 ** currencyDecimals(currency);
  return Math.round(amount * factor);
}

export function fromMinorUnits(minor: number, currency: string): number {
  const factor = 10 ** currencyDecimals(currency);
  return minor / factor;
}

export function parseAmountToMinorUnits(
  raw: string | number,
  currency: string
): number | null {
  const normalized =
    typeof raw === "number"
      ? String(raw)
      : raw.trim().replace(/\s/g, "").replace(",", ".");

  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  return toMinorUnits(Number(normalized), currency);
}

export const AMBIGUOUS_AMOUNT_ERROR =
  "El importe no es claro. Escríbelo como 1500 o 1500,50.";

/** `1.500`, `1,500` o `1.500,00` no dicen si el punto es miles o decimal. */
export function ambiguousAmount(raw: string, currency: string): boolean {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return false;
  const dots = trimmed.split(".").length - 1;
  const commas = trimmed.split(",").length - 1;
  if ((dots > 0 && commas > 0) || dots > 1 || commas > 1) return true;
  const separator = dots === 1 ? "." : commas === 1 ? "," : "";
  if (!separator) return false;
  const fraction = trimmed.split(separator)[1] ?? "";
  return fraction.length === 3 && currencyDecimals(currency) !== 3;
}

export function parseAgentAmount(raw: string, currency: string): number | null {
  if (ambiguousAmount(raw, currency)) return null;
  return parseAmountToMinorUnits(raw, currency);
}

export function formatMoney(
  minor: number,
  currency: string,
  options: { withCode?: boolean } = {}
): string {
  const decimals = currencyDecimals(currency);
  const value = fromMinorUnits(minor, currency);

  const formatted = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  return options.withCode ? `${formatted} (${currency.toUpperCase()})` : formatted;
}

// Zexel exige siempre dos decimales en el CSV del lote.
export function formatZexelAmount(minor: number, currency: string): string {
  return fromMinorUnits(minor, currency).toFixed(2);
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(ratio);
}

// Convierte un importe en moneda del creator a céntimos de USD usando el tipo
// de cambio guardado en el contrato (unidades de esa moneda por 1 USD).
export function convertToUsdCents(
  minor: number,
  currency: string,
  unitsPerUsd: number
): number {
  if (unitsPerUsd <= 0) return 0;

  const amount = fromMinorUnits(minor, currency);
  return Math.round((amount / unitsPerUsd) * 100);
}
