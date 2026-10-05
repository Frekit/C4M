import { extractInstagramHandle } from "@/lib/domain/validation";

export type RosterImportRow = {
  line: number;
  handle: string;
  country: string | null;
  profileType: string | null;
  cost: string | null;
  currency: string | null;
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

const COST_HEADERS = ["tarifa", "coste", "cost", "rate", "precio"];

const CURRENCY_HEADERS = ["moneda", "currency", "divisa"];

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

function splitCsvRecords(raw: string, delimiter: string): { cells: string[]; line: number }[] {
  const records: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let current = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  const pushCell = () => {
    cells.push(current.trim());
    current = "";
  };

  const pushRecord = () => {
    pushCell();
    if (cells.some((cell) => cell.length > 0)) {
      records.push({ cells, line: recordLine });
    }
    cells = [];
    recordLine = line;
  };

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === '"') {
      if (quoted && raw[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === delimiter && !quoted) {
      pushCell();
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && raw[index + 1] === "\n") index += 1;
      line += 1;
      pushRecord();
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && raw[index + 1] === "\n") index += 1;
      line += 1;
      current += "\n";
      continue;
    }
    current += char;
  }

  if (quoted || current.length > 0 || cells.length > 0) {
    pushRecord();
  }

  return records;
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
  const text = stripBom(raw);
  if (!text.trim()) {
    return { rows: [], errors: [{ line: 0, message: "El archivo está vacío." }] };
  }

  const probeLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  let delimiter = ",";
  let records: { cells: string[]; line: number }[] = [];
  let headerIndex = 0;
  let headers: string[] = [];
  let instagramCol = -1;

  for (const probe of probeLines) {
    delimiter = detectDelimiter(probe);
    records = splitCsvRecords(text, delimiter);
    instagramCol = -1;
    for (let index = 0; index < Math.min(records.length, 8); index += 1) {
      headers = (records[index]?.cells ?? []).map(normalizeHeader);
      instagramCol = firstMatchingIndex(headers, INSTAGRAM_HEADERS);
      if (instagramCol >= 0) {
        headerIndex = index;
        break;
      }
    }
    if (instagramCol >= 0) break;
  }

  if (records.length === 0) {
    return { rows: [], errors: [{ line: 0, message: "El archivo está vacío." }] };
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
  const costCol = firstMatchingIndex(headers, COST_HEADERS);
  const currencyCol = firstMatchingIndex(headers, CURRENCY_HEADERS);
  const rows: RosterImportRow[] = [];
  const errors: RosterImportIssue[] = [];
  const seen = new Set<string>();

  for (const record of records.slice(headerIndex + 1)) {
    const handle = extractInstagramHandle(record.cells[instagramCol] ?? "");
    if (!handle) {
      errors.push({
        line: record.line,
        message: "Instagram no válido.",
      });
      continue;
    }
    if (seen.has(handle)) {
      errors.push({
        line: record.line,
        message: `@${handle} está repetido en el archivo.`,
      });
      continue;
    }
    seen.add(handle);
    rows.push({
      line: record.line,
      handle,
      country: countryCol >= 0 ? cleanCell(record.cells[countryCol] ?? "") : null,
      profileType: typeCol >= 0 ? cleanCell(record.cells[typeCol] ?? "") : null,
      cost: costCol >= 0 ? cleanCell(record.cells[costCol] ?? "") : null,
      currency:
        currencyCol >= 0 ? cleanCell(record.cells[currencyCol] ?? "") : null,
    });
  }

  return { rows, errors };
}
