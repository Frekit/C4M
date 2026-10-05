import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCampaignSheetRow,
  buildSheetPulse,
  filterCampaignSheet,
  type SheetCreatorInput,
} from "@/lib/domain/campaign-sheet";

const NOW = new Date("2026-10-05T12:00:00.000Z");
const CAMPAIGN = "camp-1";

function creator(overrides: Partial<SheetCreatorInput> = {}): SheetCreatorInput {
  return {
    id: "c1",
    handle: "ana.garcia",
    displayName: "Ana",
    country: "es",
    countryLabel: "España",
    profileType: "micro",
    profileTypeLabel: "Micro",
    igMedianViews: 12500,
    igMedianViewsAt: new Date("2026-10-01T12:00:00.000Z"),
    quotes: [
      {
        platform: "INSTAGRAM",
        format: "REEL",
        quantity: 1,
        costMinor: 15000,
        currency: "EUR",
      },
      {
        platform: "TIKTOK",
        format: "VIDEO",
        quantity: 1,
        costMinor: 8000,
        currency: "EUR",
      },
    ],
    talents: [],
    curation: null,
    ...overrides,
  };
}

test("la planilla enseña tarifas, views y deja fuera a quien ya está abierto", () => {
  const fresh = buildCampaignSheetRow(creator(), CAMPAIGN, NOW);
  assert.equal(fresh.place, "out");
  assert.equal(fresh.selectable, true);
  assert.equal(fresh.statusLabel, "Fuera");
  assert.equal(fresh.viewsLabel, "12.500");
  assert.equal(fresh.viewsStale, false);
  assert.match(fresh.quotesLabel, /Instagram · 1 reel/);
  assert.match(fresh.quotesLabel, /TikTok · 1 vídeo/);
  assert.equal(fresh.rates[0]?.platformLabel, "Instagram");
  assert.equal(fresh.rates[1]?.platformLabel, "TikTok");
  assert.match(fresh.rates[0]?.amountLabel ?? "", /€/);

  const open = buildCampaignSheetRow(
    creator({
      talents: [
        {
          status: "READY",
          createdAt: new Date("2026-10-02T00:00:00.000Z"),
          campaignId: CAMPAIGN,
          campaignName: "UX",
          clientName: "Higgsfield",
          deliverableCount: 8,
          contentPlatform: "INSTAGRAM",
          contentFormat: "REEL",
          salePriceCentsPerContent: 20000,
          costMinorPerContent: 12500,
          costCurrency: "EUR",
          packageCostMinor: 100000,
        },
      ],
    }),
    CAMPAIGN,
    NOW
  );
  assert.equal(open.place, "open");
  assert.equal(open.selectable, false);
  assert.equal(open.statusLabel, "Listo");
  assert.equal(open.formatLabel, "Instagram · 8 reels");
  assert.equal(open.piecesLabel, "8");
  assert.match(open.costLabel, /paquete/);
  assert.match(open.saleLabel, /pieza/);

  const again = buildCampaignSheetRow(
    creator({
      talents: [
        {
          status: "ACTIVE",
          createdAt: new Date("2026-09-01T00:00:00.000Z"),
          campaignId: CAMPAIGN,
          campaignName: "UX",
          clientName: null,
          deliverableCount: 1,
          contentPlatform: null,
          contentFormat: null,
          salePriceCentsPerContent: 10000,
          costMinorPerContent: 15000,
          costCurrency: "EUR",
          packageCostMinor: null,
        },
        {
          status: "ROSTER",
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          campaignId: "otra",
          campaignName: "Launch",
          clientName: "Many Chat",
          deliverableCount: null,
          contentPlatform: null,
          contentFormat: null,
          salePriceCentsPerContent: null,
          costMinorPerContent: null,
          costCurrency: null,
          packageCostMinor: null,
        },
      ],
    }),
    CAMPAIGN,
    NOW
  );
  assert.equal(again.place, "active");
  assert.equal(again.selectable, true);
  assert.equal(again.othersLabel, "Many Chat · Launch");
  assert.match(again.costLabel, /pieza/);
});

test("filtra por texto, país, views, mesa y red", () => {
  const rows = [
    buildCampaignSheetRow(creator(), CAMPAIGN, NOW),
    buildCampaignSheetRow(
      creator({
        id: "c2",
        handle: "luis",
        displayName: null,
        country: "mx",
        countryLabel: "México",
        profileType: "ugc",
        profileTypeLabel: "UGC",
        igMedianViews: null,
        igMedianViewsAt: null,
        quotes: [],
        talents: [
          {
            status: "REJECTED",
            createdAt: NOW,
            campaignId: CAMPAIGN,
            campaignName: "UX",
            clientName: null,
            deliverableCount: null,
            contentPlatform: null,
            contentFormat: null,
            salePriceCentsPerContent: null,
            costMinorPerContent: null,
            costCurrency: null,
            packageCostMinor: null,
          },
        ],
      }),
      CAMPAIGN,
      NOW
    ),
  ];

  assert.deepEqual(
    filterCampaignSheet(rows, { q: "ana" }).map((row) => row.handle),
    ["ana.garcia"]
  );
  assert.deepEqual(
    filterCampaignSheet(rows, { countryValues: ["mx"] }).map((row) => row.handle),
    ["luis"]
  );
  assert.deepEqual(
    filterCampaignSheet(rows, { views: "pendientes" }).map((row) => row.handle),
    ["luis"]
  );
  assert.deepEqual(
    filterCampaignSheet(rows, { views: "al-dia" }).map((row) => row.handle),
    ["ana.garcia"]
  );
  assert.deepEqual(
    filterCampaignSheet(rows, { mesa: "descartada" }).map((row) => row.handle),
    ["luis"]
  );
  assert.deepEqual(
    filterCampaignSheet(rows, { red: "TIKTOK" }).map((row) => row.handle),
    ["ana.garcia"]
  );
  assert.deepEqual(
    filterCampaignSheet(rows, { red: "sin" }).map((row) => row.handle),
    ["luis"]
  );
  assert.equal(rows[1].viewsStale, true);
  assert.equal(rows[1].quotesLabel, "Sin tarifas");
});

test("apartar y descartar no pisan una línea abierta", () => {
  const saved = buildCampaignSheetRow(
    creator({ curation: "SAVED" }),
    CAMPAIGN,
    NOW
  );
  assert.equal(saved.place, "saved");
  assert.equal(saved.statusLabel, "Apartado");
  assert.equal(saved.selectable, true);
  assert.equal(saved.removable, false);

  const dismissed = buildCampaignSheetRow(
    creator({ id: "c3", handle: "nora", curation: "DISMISSED" }),
    CAMPAIGN,
    NOW
  );
  assert.equal(dismissed.place, "dismissed");
  assert.equal(dismissed.statusLabel, "No entra");

  const openWins = buildCampaignSheetRow(
    creator({
      curation: "SAVED",
      talents: [
        {
          status: "ROSTER",
          createdAt: NOW,
          campaignId: CAMPAIGN,
          campaignName: "UX",
          clientName: null,
          deliverableCount: null,
          contentPlatform: null,
          contentFormat: null,
          salePriceCentsPerContent: null,
          costMinorPerContent: null,
          costCurrency: null,
          packageCostMinor: null,
        },
      ],
    }),
    CAMPAIGN,
    NOW
  );
  assert.equal(openWins.place, "open");
  assert.equal(openWins.removable, true);
  assert.equal(openWins.selectable, false);

  assert.deepEqual(
    filterCampaignSheet([saved, dismissed, openWins], { mesa: "apartada" }).map(
      (row) => row.handle
    ),
    ["ana.garcia"]
  );
  assert.deepEqual(
    filterCampaignSheet([saved, dismissed], { mesa: "no" }).map((row) => row.handle),
    ["nora"]
  );
});

test("la franja suma views frescas de la mesa y la venta comprometida", () => {
  const rows = [
    buildCampaignSheetRow(
      creator({
        igMedianViews: 1000,
        talents: [
          {
            status: "PROPOSED",
            createdAt: NOW,
            campaignId: CAMPAIGN,
            campaignName: "UX",
            clientName: null,
            deliverableCount: 2,
            contentPlatform: "INSTAGRAM",
            contentFormat: "REEL",
            salePriceCentsPerContent: 5000,
            costMinorPerContent: 1000,
            costCurrency: "EUR",
            packageCostMinor: 2000,
          },
        ],
      }),
      CAMPAIGN,
      NOW
    ),
    buildCampaignSheetRow(
      creator({
        id: "c2",
        handle: "viejo",
        igMedianViews: 9000,
        igMedianViewsAt: new Date("2026-08-01T00:00:00.000Z"),
        curation: "SAVED",
      }),
      CAMPAIGN,
      NOW
    ),
  ];
  const pulse = buildSheetPulse(
    rows,
    [
      {
        status: "PROPOSED",
        salePriceCentsPerContent: 5000,
        costMinorPerContent: 1000,
        costCurrency: "EUR",
        deliverableCount: 2,
      },
    ],
    { engagementKind: "BUDGET", budgetSaleCents: 20000 }
  );
  assert.equal(rows[0].place, "open");
  assert.equal(rows[0].removable, false);
  assert.equal(pulse.onDesk, 1);
  assert.equal(pulse.saved, 1);
  assert.equal(pulse.freshViews, 1000);
  assert.equal(pulse.committedSaleCents, 10000);
  assert.equal(pulse.remainingCents, 10000);
});
