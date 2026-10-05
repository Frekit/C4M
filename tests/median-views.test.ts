import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isMedianViewsStale,
  medianViewsDueAt,
  parseMedianViews,
} from "@/lib/domain/median-views";

const day = 24 * 60 * 60 * 1000;

test("la mediana acepta un entero y el separador de miles", () => {
  assert.deepEqual(parseMedianViews("12500"), { ok: true, views: 12500 });
  assert.deepEqual(parseMedianViews("12.500"), { ok: true, views: 12500 });
  assert.deepEqual(parseMedianViews("1,250,000"), { ok: true, views: 1_250_000 });
  assert.deepEqual(parseMedianViews("0"), { ok: true, views: 0 });
  assert.equal(parseMedianViews("").ok, false);
  assert.equal(parseMedianViews("12.5").ok, false);
  assert.equal(parseMedianViews("-4").ok, false);
});

test("a los 15 días la mediana está para actualizar", () => {
  const recordedAt = new Date("2026-10-05T00:00:00.000Z");
  assert.equal(
    medianViewsDueAt(recordedAt).toISOString(),
    "2026-10-20T00:00:00.000Z"
  );
  assert.equal(
    isMedianViewsStale({
      views: 12500,
      recordedAt,
      now: new Date(recordedAt.getTime() + 14 * day),
    }),
    false
  );
  assert.equal(
    isMedianViewsStale({
      views: 12500,
      recordedAt,
      now: new Date(recordedAt.getTime() + 15 * day),
    }),
    true
  );
  assert.equal(
    isMedianViewsStale({ views: null, recordedAt: null, now: recordedAt }),
    true
  );
});
