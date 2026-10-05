import { extractInstagramHandle } from "@/lib/domain/instagram-handle";

export type CreatorImportRow = {
  line: number;
  handle: string;
  email: string;
  client: string;
  deliverableCount: number;
  saleUsd: string;
  cost: string;
  currency: string;
  termDays: number;
  campaign: string;
};

export type CreatorImportIssue = {
  line: number;
  message: string;
};

export const CREATOR_CSV_HEADER =
  "handle,email,client,deliverables,sale_usd,cost,currency,term_days,campaign";

export const CREATOR_CSV_EXAMPLE = `${CREATOR_CSV_HEADER}
marcosrouder,marcos@example.com,Higgsfield,3,250,80,EUR,30,Higgs Q3
`

function splitCsvLine(line: string): string[] {
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
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function parseCreatorCsv(raw: string): {
  rows: CreatorImportRow[];
  errors: CreatorImportIssue[];
} {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows: [], errors: [{ line: 0, message: "El CSV está vacío." }] };
  }

  const header = splitCsvLine(lines[0] ?? "").map((cell) =>
    cell.toLowerCase().replace(/\s+/g, "_")
  );
  const expected = CREATOR_CSV_HEADER.split(",");
  const missing = expected.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message: `Faltan columnas: ${missing.join(", ")}. Usa ${CREATOR_CSV_HEADER}`,
        },
      ],
    };
  }

  const indexOf = Object.fromEntries(
    expected.map((column) => [column, header.indexOf(column)])
  );
  const rows: CreatorImportRow[] = [];
  const errors: CreatorImportIssue[] = [];

  for (let lineNumber = 2; lineNumber <= lines.length; lineNumber += 1) {
    const cells = splitCsvLine(lines[lineNumber - 1] ?? "");
    const value = (column: string) => cells[indexOf[column] ?? -1] ?? "";
    const handle = extractInstagramHandle(value("handle"));
    if (!handle) {
      errors.push({ line: lineNumber, message: "Handle de Instagram no válido." });
      continue;
    }

    const email = value("email").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ line: lineNumber, message: "Email no válido." });
      continue;
    }

    const client = value("client").trim();
    if (client.length < 2) {
      errors.push({ line: lineNumber, message: "Falta el cliente." });
      continue;
    }

    const deliverableCount = Number.parseInt(value("deliverables"), 10);
    if (!Number.isFinite(deliverableCount) || deliverableCount < 1) {
      errors.push({
        line: lineNumber,
        message: "deliverables tiene que ser un entero ≥ 1.",
      });
      continue;
    }

    const saleUsd = value("sale_usd").trim();
    const cost = value("cost").trim();
    if (!saleUsd || !cost) {
      errors.push({ line: lineNumber, message: "Faltan importes." });
      continue;
    }

    const currency = value("currency").trim().toUpperCase() || "EUR";
    const termDays = Number.parseInt(value("term_days") || "30", 10);

    rows.push({
      line: lineNumber,
      handle,
      email,
      client,
      deliverableCount,
      saleUsd,
      cost,
      currency,
      termDays: Number.isFinite(termDays) && termDays >= 0 ? termDays : 30,
      campaign: value("campaign").trim(),
    });
  }

  return { rows, errors };
}
