import assert from "node:assert/strict";
import { test } from "node:test";

import { SETTLEMENT_MODE } from "@/lib/domain/enums";
import { clientUpdateSchema } from "@/lib/domain/validation";

test("editar cliente acepta pack y casilla de plataforma desmarcada", () => {
  const result = clientUpdateSchema.safeParse({
    clientId: "client_manychat_001",
    name: "Many Chat",
    settlementMode: SETTLEMENT_MODE.PACK,
    requiresPlatformSubmit: null,
    notes: "",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.settlementMode, SETTLEMENT_MODE.PACK);
    assert.equal(result.data.requiresPlatformSubmit, false);
    assert.equal(result.data.notes, "");
  }
});

test("editar cliente exige nombre y un modo de liquidación válido", () => {
  const unnamed = clientUpdateSchema.safeParse({
    clientId: "client_1",
    name: " ",
    settlementMode: SETTLEMENT_MODE.PER_CONTENT,
    requiresPlatformSubmit: "on",
    notes: "",
  });
  const badMode = clientUpdateSchema.safeParse({
    clientId: "client_1",
    name: "Higgsfield",
    settlementMode: "WEEKLY",
    requiresPlatformSubmit: "on",
    notes: "",
  });

  assert.equal(unnamed.success, false);
  assert.equal(badMode.success, false);
});

test("editar cliente con plataforma marcada queda en pieza a pieza", () => {
  const result = clientUpdateSchema.safeParse({
    clientId: "client_higgs_001",
    name: "Higgsfield",
    settlementMode: SETTLEMENT_MODE.PER_CONTENT,
    requiresPlatformSubmit: "on",
    notes: "Subir a Higgs",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.requiresPlatformSubmit, true);
    assert.equal(result.data.notes, "Subir a Higgs");
  }
});
