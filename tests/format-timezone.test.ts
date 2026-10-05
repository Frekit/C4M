import assert from "node:assert/strict";
import { test } from "node:test";

import { formatDateTime, formatDateTimeUtc } from "@/lib/format";

test("formatDateTime usa Europe/Madrid y formatDateTimeUtc añade el sufijo UTC", () => {
  const value = new Date("2026-10-19T01:15:00.000Z");

  assert.match(formatDateTime(value), /03:15/);
  assert.doesNotMatch(formatDateTime(value), /UTC/);
  assert.match(formatDateTimeUtc(value), /01:15/);
  assert.match(formatDateTimeUtc(value), /UTC$/);
});
