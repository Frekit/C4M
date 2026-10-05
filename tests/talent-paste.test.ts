import assert from "node:assert/strict";
import { test } from "node:test";

import { handlesFromPaste } from "@/lib/domain/talent-paste";

test("pega handles, urls y descarta lo que no es Instagram", () => {
  const parsed = handlesFromPaste(`
    @ana.garcia
    https://www.instagram.com/marcosrouder/
    sofia.tech, @ana.garcia
    no-es-un-perfil
  `);
  assert.deepEqual(parsed.handles, ["ana.garcia", "marcosrouder", "sofia.tech"]);
  assert.equal(parsed.invalid, 1);
});
