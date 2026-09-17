import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePage, queryHref } from "@/lib/domain/paging";

test("parsePage nunca baja de 1", () => {
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage("2"), 2);
  assert.equal(parsePage("0"), 1);
});

test("queryHref omite página 1 y parámetros vacíos", () => {
  assert.equal(queryHref("/finanzas", { campana: "c1" }), "/finanzas?campana=c1");
  assert.equal(
    queryHref("/finanzas", { campana: "c1", pagina: "9" }, 3),
    "/finanzas?campana=c1&pagina=3"
  );
  assert.equal(queryHref("/creators", { q: "" }), "/creators");
});
