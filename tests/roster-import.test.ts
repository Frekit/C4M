import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeCreatorPresence } from "@/lib/domain/campaign-talent";
import { CAMPAIGN_TALENT_STATUS } from "@/lib/domain/enums";
import { parseRosterTable } from "@/lib/domain/roster-import";

test("lee Excel pegado con encabezados en español", () => {
  const parsed = parseRosterTable(`instagram;país;tipo
https://www.instagram.com/marcosrouder;España;Micro
@ana.garcia;México;UGC
`);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0]?.handle, "marcosrouder");
  assert.equal(parsed.rows[0]?.country, "España");
  assert.equal(parsed.rows[1]?.handle, "ana.garcia");
  assert.equal(parsed.rows[1]?.profileType, "UGC");
});

test("acepta solo la columna de Instagram", () => {
  const parsed = parseRosterTable(`handle
sofia.tech
`);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]?.handle, "sofia.tech");
  assert.equal(parsed.rows[0]?.country, null);
});

test("rechaza un archivo sin columna de Instagram", () => {
  const parsed = parseRosterTable(`nombre,ciudad
Pepe,Madrid
`);
  assert.equal(parsed.rows.length, 0);
  assert.match(parsed.errors[0]?.message ?? "", /Instagram/);
});

test("la visibilidad junta roster y campañas con piezas", () => {
  const presence = mergeCreatorPresence(
    [
      {
        campaignId: "a",
        status: CAMPAIGN_TALENT_STATUS.PROPOSED,
        campaign: { name: "Launch Q4", status: "ACTIVE" },
      },
    ],
    [{ id: "b", name: "Always-on", status: "ACTIVE" }]
  );
  assert.equal(presence.length, 2);
  assert.equal(presence.find((item) => item.campaignId === "a")?.talentStatus, "PROPOSED");
  assert.equal(presence.find((item) => item.campaignId === "b")?.source, "deliverable");
});
