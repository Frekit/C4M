import assert from "node:assert/strict";
import { test } from "node:test";

import { clientAuthorLabel } from "@/lib/domain/client-author-label";

test("un nombre vacío se ve como Cliente", () => {
  assert.equal(clientAuthorLabel(null), "Cliente");
  assert.equal(clientAuthorLabel(undefined), "Cliente");
  assert.equal(clientAuthorLabel("   "), "Cliente");
  assert.equal(clientAuthorLabel("Cliente"), "Cliente");
});

test("Agencia, Mesa o un nombre del equipo siguen marcados como Cliente", () => {
  for (const name of ["Agencia", "agencia", "AGENCIA", "Mesa", "Álvaro Romero", "Lector"]) {
    const label = clientAuthorLabel(name);
    assert.equal(label.startsWith("Cliente"), true, label);
    assert.notEqual(label, name);
  }
  assert.equal(clientAuthorLabel("Ana, de la marca"), "Cliente · Ana, de la marca");
});

test("el prefijo no se duplica y no se puede reordenar con caracteres invisibles", () => {
  assert.equal(clientAuthorLabel("Cliente · Ana"), "Cliente · Ana");
  assert.equal(clientAuthorLabel("cliente · Ana"), "Cliente · Ana");
  assert.equal(clientAuthorLabel("Agencia\u202E"), "Cliente · Agencia");
  assert.equal(clientAuthorLabel("Ana\nLópez"), "Cliente · Ana López");
});
