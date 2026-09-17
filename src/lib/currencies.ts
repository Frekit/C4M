// Lista de monedas de pago. El precio de venta al cliente es siempre USD, pero
// al creator se le paga en la suya, así que esto tiene que ser amplio.
export const CURRENCIES: { code: string; name: string }[] = [
  { code: "USD", name: "Dólar estadounidense" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "Libra esterlina" },
  { code: "MXN", name: "Peso mexicano" },
  { code: "COP", name: "Peso colombiano" },
  { code: "ARS", name: "Peso argentino" },
  { code: "CLP", name: "Peso chileno" },
  { code: "PEN", name: "Sol peruano" },
  { code: "BRL", name: "Real brasileño" },
  { code: "UYU", name: "Peso uruguayo" },
  { code: "DOP", name: "Peso dominicano" },
  { code: "CRC", name: "Colón costarricense" },
  { code: "GTQ", name: "Quetzal guatemalteco" },
  { code: "CAD", name: "Dólar canadiense" },
  { code: "CHF", name: "Franco suizo" },
  { code: "SEK", name: "Corona sueca" },
  { code: "NOK", name: "Corona noruega" },
  { code: "DKK", name: "Corona danesa" },
  { code: "PLN", name: "Zloty polaco" },
  { code: "CZK", name: "Corona checa" },
  { code: "RON", name: "Leu rumano" },
  { code: "TRY", name: "Lira turca" },
  { code: "MAD", name: "Dirham marroquí" },
  { code: "AED", name: "Dirham de Emiratos" },
  { code: "ILS", name: "Séquel israelí" },
  { code: "ZAR", name: "Rand sudafricano" },
  { code: "NGN", name: "Naira nigeriana" },
  { code: "EGP", name: "Libra egipcia" },
  { code: "INR", name: "Rupia india" },
  { code: "IDR", name: "Rupia indonesia" },
  { code: "PHP", name: "Peso filipino" },
  { code: "THB", name: "Baht tailandés" },
  { code: "VND", name: "Dong vietnamita" },
  { code: "JPY", name: "Yen japonés" },
  { code: "KRW", name: "Won surcoreano" },
  { code: "CNY", name: "Yuan chino" },
  { code: "HKD", name: "Dólar de Hong Kong" },
  { code: "SGD", name: "Dólar de Singapur" },
  { code: "AUD", name: "Dólar australiano" },
  { code: "NZD", name: "Dólar neozelandés" },
];

const CURRENCY_CODES = new Set(CURRENCIES.map((currency) => currency.code));

export function isSupportedCurrency(code: string): boolean {
  return CURRENCY_CODES.has(code.toUpperCase());
}

export function currencyName(code: string): string {
  return (
    CURRENCIES.find((currency) => currency.code === code.toUpperCase())?.name ??
    code.toUpperCase()
  );
}
