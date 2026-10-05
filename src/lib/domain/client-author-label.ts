// El cliente del enlace elige un nombre libre. El rol lo pone el servidor,
// para que "Agencia" o el nombre de alguien del equipo no parezcan la agencia.
const BIDI_AND_INVISIBLE =
  /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export function clientAuthorLabel(raw: string | null | undefined): string {
  const cleaned = String(raw ?? "")
    .replace(BIDI_AND_INVISIBLE, "")
    .replace(/\s+/g, " ")
    .trim();
  const name = stripClientRole(cleaned);
  if (!name) return "Cliente";
  return `Cliente · ${name}`;
}

function stripClientRole(value: string): string {
  if (/^cliente$/i.test(value)) return "";
  const prefixed = value.match(/^cliente\s*·\s*(.*)$/i);
  if (!prefixed) return value;
  return prefixed[1].trim();
}
