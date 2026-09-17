import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isExpiredLiveSignature,
  isUnsignedWithPublished,
} from "@/lib/domain/ops-alerts";

test("un enlace vivo caduca cuando pasa expiresAt", () => {
  const now = new Date("2026-09-17T12:00:00.000Z");
  assert.equal(
    isExpiredLiveSignature({
      status: "PENDING",
      expiresAt: new Date("2026-09-16T12:00:00.000Z"),
      now,
    }),
    true
  );
  assert.equal(
    isExpiredLiveSignature({
      status: "VIEWED",
      expiresAt: new Date("2026-09-18T12:00:00.000Z"),
      now,
    }),
    false
  );
  assert.equal(
    isExpiredLiveSignature({
      status: "SIGNED",
      expiresAt: new Date("2026-09-16T12:00:00.000Z"),
      now,
    }),
    false
  );
});

test("alerta si hay posts en redes y el contrato aún no está firmado", () => {
  assert.equal(
    isUnsignedWithPublished({ status: "DRAFT", publishedCount: 1 }),
    true
  );
  assert.equal(
    isUnsignedWithPublished({ status: "SENT", publishedCount: 2 }),
    true
  );
  assert.equal(
    isUnsignedWithPublished({ status: "SIGNED", publishedCount: 2 }),
    false
  );
  assert.equal(
    isUnsignedWithPublished({ status: "DRAFT", publishedCount: 0 }),
    false
  );
});
