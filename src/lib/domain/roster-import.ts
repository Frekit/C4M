import { extractInstagramHandle } from "@/lib/domain/validation";

export type RosterImportRow = {
  line: number;
  handle: string;
  country: string | null;
  profileType: string | null;
};

export type RosterImportIssue = {
  line: number;
  message: string;
};

export const ROSTER_CSV_HEADER = "instagram,pais,tipo";

export const ROSTER_CSV_EXAMPLE = `${ROSTER_CSV_HEADER}
https://www.instagram.com/marcosrouder,España,Micro
@anagarcia,México,UGC
sofia.tech,,Tech
`;

const INSTAGRAM_HEADERS = [
  "instagram",
  "ig",
  "handle",
  "perfil",
  "profile",
  "url",
  "usuario",
  "user",
  "cuenta",
  "username",
];

const COUNTRY_HEADERS = ["pais", "country", "nacion", "nation", "geo"];

const TYPE_HEADERS = [
  "tipo",
  "tipo_de_perfil",
  "tipo_perfil",
  "profile_type",
  "perfil_tipo",
  "categoria",
  "category",
  "nicho",
];

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

export function normalizeHeader(value: string) {
  return stripBom(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function detectDelimiter(line: string) {
  const comma = (line.match(/,/g) ?? []).length;
  const semi = (line.match(/;/g) ?? []).length;
  const tab = (line.match(/\t/g) ?? []).length;
  if (tab >= comma && tab >= semi && tab > 0) return "\t";
  if (semi > comma) return ";";
  return ",";
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function firstMatchingIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

function cleanCell(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseRosterTable(raw: string): {
  rows: RosterImportRow[];
  errors: RosterImportIssue[];
} {
  const lines = stripBom(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, message: "El archivo está vacío." }] };
  }

  let headerIndex = 0;
  let headers: string[] = [];
  let delimiter = ",";
  let instagramCol = -1;

  for (let index = 0; index < Math.min(lines.length, 8); index += 1) {
    delimiter = detectDelimiter(lines[index] ?? "");
    headers = splitCsvLine(lines[index] ?? "", delimiter).map(normalizeHeader);
    instagramCol = firstMatchingIndex(headers, INSTAGRAM_HEADERS);
    if (instagramCol >= 0) {
      headerIndex = index;
      break;
    }
  }

  if (instagramCol < 0) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message:
            "No encuentro la columna de Instagram. Pon un encabezado tipo instagram, handle, perfil o url.",
        },
      ],
    };
  }

  const countryCol = firstMatchingIndex(headers, COUNTRY_HEADERS);
  const typeCol = firstMatchingIndex(headers, TYPE_HEADERS);
  const rows: RosterImportRow[] = [];
  const errors: RosterImportIssue[] = [];
  const seen = new Set<string>();

  for (let lineNumber = headerIndex + 2; lineNumber <= lines.length; lineNumber += 1) {
    const cells = splitCsvLine(lines[lineNumber - 1] ?? "", delimiter);
    const handle = extractInstagramHandle(cells[instagramCol] ?? "");
    if (!handle) {
      errors.push({
        line: lineNumber,
        message: "Instagram no válido.",
      });
      continue;
    }
    if (seen.has(handle)) {
      errors.push({
        line: lineNumber,
        message: `@${handle} está repetido en el archivo.`,
      });
      continue;
    }
    seen.add(handle);
    rows.push({
      line: lineNumber,
      handle,
      country: countryCol >= 0 ? cleanCell(cells[countryCol] ?? "") : null,
      profileType: typeCol >= 0 ? cleanCell(cells[typeCol] ?? "") : null,
    });
  }

  return { rows, errors };
}
