import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CONTENTS_PAGE_SIZE,
  buildDeliverableWhere,
  buildLateDeliverableWhere,
  contentsHref,
  parsePage,
  statusCountsFromGroup,
  withLiveStatus,
} from "@/lib/domain/contents-query";

test("la página de contenidos es 60 y nunca baja de 1", () => {
  assert.equal(CONTENTS_PAGE_SIZE, 60);
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage("1"), 1);
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage("0"), 1);
  assert.equal(parsePage("-4"), 1);
  assert.equal(parsePage("no"), 1);
});

test("el enlace de contenidos conserva filtros y omite la página 1", () => {
  assert.equal(contentsHref({}), "/contenidos");
  assert.equal(contentsHref({}, 1), "/contenidos");
  assert.equal(contentsHref({}, 2), "/contenidos?pagina=2");
  assert.equal(
    contentsHref({ creador: "c1", estado: "PUBLISHED", retrasados: "1" }, 3),
    "/contenidos?creador=c1&estado=PUBLISHED&retrasados=1&pagina=3"
  );
});

test("el where de contenidos aplica creator, campaña vacía y estado", () => {
  const where = buildDeliverableWhere({
    creador: "cr1",
    campana: "sin",
    estado: "SCHEDULED",
  });

  assert.deepEqual(where.campaignId, null);
  assert.equal(where.status, "SCHEDULED");
  assert.equal(
    where.contract &&
      typeof where.contract === "object" &&
      "creatorId" in where.contract
      ? where.contract.creatorId
      : null,
    "cr1"
  );
});

test("retrasados pisa el estado y deja fuera lo ya publicado", () => {
  const where = buildDeliverableWhere({
    estado: "PUBLISHED",
    retrasados: "1",
  });

  assert.deepEqual(where.status, { notIn: ["PUBLISHED", "SUBMITTED"] });
  assert.ok(
    where.scheduledFor &&
      typeof where.scheduledFor === "object" &&
      "lt" in where.scheduledFor
  );
  assert.equal(withLiveStatus(where), null);
});

test("el rango de fechas mira prevista o publicada", () => {
  const where = buildDeliverableWhere({
    desde: "2026-09-01",
    hasta: "2026-09-30",
  });

  assert.ok(Array.isArray(where.OR));
  assert.equal(where.OR?.length, 2);
  assert.deepEqual(withLiveStatus(where), {
    AND: [where, { status: { in: ["PUBLISHED", "SUBMITTED"] } }],
  });
});

test("si el filtro ya es un estado en redes, el where de devengo no se ensancha", () => {
  const published = buildDeliverableWhere({ estado: "PUBLISHED" });
  assert.equal(withLiveStatus(published), published);
  assert.equal(withLiveStatus(buildDeliverableWhere({ estado: "PENDING" })), null);
});

test("los retrasados se cuentan sobre el universo filtrado, no sobre la página", () => {
  const now = new Date("2026-09-17T12:00:00.000Z");
  const where = buildLateDeliverableWhere({ creador: "cr1" }, now);

  assert.ok(Array.isArray(where.AND));
  assert.deepEqual(where.AND?.[1], {
    status: { notIn: ["PUBLISHED", "SUBMITTED"] },
    scheduledFor: { lt: now },
  });
});

test("sin enlace, error de plataforma y sin firmar recortan el where", () => {
  const missing = buildDeliverableWhere({ sinEnlace: "1" });
  assert.equal(missing.status, "PUBLISHED");
  assert.equal(missing.postUrl, null);

  const platform = buildDeliverableWhere({ errorPlataforma: "1" });
  assert.deepEqual(platform.platformSubmitError, { not: null });

  const unsigned = buildDeliverableWhere({ sinFirmar: "1" });
  assert.ok(
    unsigned.contract &&
      typeof unsigned.contract === "object" &&
      "status" in unsigned.contract
  );
});

test("el enlace de contenidos incluye las colas de incidencia", () => {
  assert.equal(
    contentsHref({ campana: "c1", sinEnlace: "1", errorPlataforma: "1" }, 2),
    "/contenidos?campana=c1&sinEnlace=1&errorPlataforma=1&pagina=2"
  );
});

test("los badges de estado salen del groupBy, con ceros para los que no aparecen", () => {
  const counts = statusCountsFromGroup([
    { status: "PENDING", _count: { _all: 12 } },
    { status: "PUBLISHED", _count: { _all: 4 } },
  ]);

  assert.equal(counts.PENDING, 12);
  assert.equal(counts.SCHEDULED, 0);
  assert.equal(counts.PUBLISHED, 4);
  assert.equal(counts.SUBMITTED, 0);
});
