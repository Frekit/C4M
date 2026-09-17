import assert from "node:assert/strict";
import { test } from "node:test";

import { SETTLEMENT_MODE } from "@/lib/domain/enums";
import { campaignSchema, fieldErrorsFrom } from "@/lib/domain/validation";

const manyChatId = "client_manychat_001";

test("una campaña de Many Chat no exige el campo de cliente nuevo", () => {
  const result = campaignSchema.safeParse({
    name: "Many Chat Q4",
    clientId: manyChatId,
    newClientName: null,
    newSettlementMode: null,
    newRequiresPlatformSubmit: null,
    description: "",
    startsAt: "",
    endsAt: "",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.clientId, manyChatId);
    assert.equal(result.data.newClientName, "");
    assert.equal(result.data.newSettlementMode, undefined);
    assert.equal(result.data.newRequiresPlatformSubmit, false);
  }
});

test("el nombre de cliente nuevo ausente no sale como Invalid input", () => {
  const result = campaignSchema.safeParse({
    name: "Many Chat Q4",
    clientId: manyChatId,
    newClientName: null,
    newSettlementMode: null,
    newRequiresPlatformSubmit: null,
    description: null,
    startsAt: null,
    endsAt: null,
  });

  assert.equal(result.success, true);
  if (!result.success) {
    const errors = fieldErrorsFrom(result.error);
    assert.equal(
      Object.values(errors).some((message) => message === "Revisa este dato"),
      false
    );
  }
});

test("nuevo cliente con liquidación pack es válido", () => {
  const result = campaignSchema.safeParse({
    name: "Pack marzo",
    clientId: "__new__",
    newClientName: "Acme",
    newSettlementMode: SETTLEMENT_MODE.PACK,
    newRequiresPlatformSubmit: null,
    description: "",
    startsAt: "2026-03-01",
    endsAt: "2026-03-31",
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.newClientName, "Acme");
    assert.equal(result.data.newSettlementMode, SETTLEMENT_MODE.PACK);
    assert.equal(result.data.newRequiresPlatformSubmit, false);
    assert.equal(result.data.startsAt?.toISOString(), "2026-03-01T00:00:00.000Z");
  }
});
