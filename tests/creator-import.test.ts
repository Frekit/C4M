import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CREATOR_CSV_HEADER,
  parseCreatorCsv,
} from "@/lib/domain/creator-import";

test("un CSV vacío o sin cabecera no se importa", () => {
  assert.equal(parseCreatorCsv("").rows.length, 0);
  assert.match(parseCreatorCsv("foo,bar").errors[0]?.message ?? "", /Faltan columnas/);
});

test("parsea filas válidas y descarta handle o email malos", () => {
  const raw = `${CREATOR_CSV_HEADER}
marcosrouder,marcos@example.com,Higgsfield,3,250,80,EUR,30,Higgs Q3
bad handle,a@b.com,Higgsfield,1,10,5,EUR,7,
@ok,not-an-email,Higgsfield,1,10,5,EUR,7,
`;
  const parsed = parseCreatorCsv(raw);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.handle, "marcosrouder");
  assert.equal(parsed.rows[0]?.deliverableCount, 3);
  assert.equal(parsed.errors.length, 2);
});
