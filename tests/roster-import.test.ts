import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeCreatorPresence } from "@/lib/domain/campaign-talent";
import { CAMPAIGN_TALENT_STATUS } from "@/lib/domain/enums";
import {
  normalizeCatalogKey,
  resolveCatalogOption,
  resolveRosterFields,
  type RosterCatalogOption,
} from "@/lib/domain/roster-catalog";
import { parseRosterTable } from "@/lib/domain/roster-import";

function option(
  slug: string,
  label: string,
  aliases: string[] = []
): RosterCatalogOption {
  return {
    id: slug,
    kind: slug === "espana" ? "COUNTRY" : "PROFILE_TYPE",
    slug,
    label,
    aliases,
    archived: false,
  };
}

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

test("el catálogo cierra país y tipo aunque el Excel lo escriba distinto", () => {
  assert.equal(normalizeCatalogKey("España"), "espana");
  const spain = option("espana", "España", ["es", "spain"]);
  const micro = option("micro", "Micro", ["microinfluencer"]);
  assert.equal(resolveCatalogOption([spain], "ES").ok, true);
  assert.equal(resolveCatalogOption([spain], "spain").ok, true);
  const resolved = resolveRosterFields(
    { countries: [spain], profileTypes: [micro] },
    { country: "Spain", profileType: "microinfluencer" }
  );
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.country, "espana");
    assert.equal(resolved.profileType, "micro");
  }
  const unknown = resolveRosterFields(
    { countries: [spain], profileTypes: [micro] },
    { country: "Wakanda", profileType: "Micro" }
  );
  assert.equal(unknown.ok, false);
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
