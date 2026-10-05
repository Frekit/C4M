import assert from "node:assert/strict";
import { test } from "node:test";

import {
  handlesFromDraft,
  networksMentioned,
  renderCampaignBriefing,
  renderClientStatus,
  type BriefingPacket,
} from "@/lib/domain/campaign-briefing";

function packet(overrides: Partial<BriefingPacket> = {}): BriefingPacket {
  return {
    campaignName: "UX probe",
    clientName: "Higgsfield",
    objective: "Lanzar el plan",
    audience: "Tecnología",
    networks: "Instagram",
    formats: "Reels",
    notes: null,
    onDesk: [{ handle: "ana", statusLabel: "Listo", saleLabel: "200,00 US$" }],
    priced: 1,
    active: 0,
    savedHandles: ["luis"],
    shortlist: ["sofia.tech"],
    published: 1,
    total: 4,
    missingUrl: 0,
    committedSaleLabel: "200,00 US$",
    remainingLabel: "300,00 US$",
    budgetLabel: "500,00 US$",
    ...overrides,
  };
}

test("el resumen del hilo no lleva el coste del perfil", () => {
  const text = renderCampaignBriefing(packet(), "hazme un plan de la campaña");
  assert.match(text, /@ana/);
  assert.match(text, /200,00 US\$/);
  assert.match(text, /@sofia\.tech/);
  assert.match(text, /Borrador para meter en la campaña/);
  assert.doesNotMatch(text, /coste/i);
  assert.doesNotMatch(text, /EUR/);
  assert.equal(handlesFromDraft(text)[0], "sofia.tech");

  const status = renderClientStatus(packet());
  assert.match(status, /1 perfil en marcha/);
  assert.match(status, /1 publicado de 4/);
  assert.match(status, /300,00 US\$/);
  assert.doesNotMatch(status, /coste|EUR|@ana/i);
});

test("sin pedido de plan no hay borrador", () => {
  const text = renderCampaignBriefing(packet(), "qué hay en la mesa");
  assert.equal(handlesFromDraft(text).length, 0);
  assert.match(text, /Esto es lo que hay/);
});

test("las redes del brief se leen para filtrar", () => {
  assert.deepEqual(networksMentioned("Instagram y TikTok"), [
    "INSTAGRAM",
    "TIKTOK",
  ]);
  assert.deepEqual(networksMentioned("mix de formatos"), []);
});
