import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isDeliverableLate,
  isLiveDeliverable,
  isPayableDeliverable,
  resolveDeliverableState,
} from "@/lib/domain/rules";

test("agendar admite fechas futuras y no devenga nada", () => {
  const future = new Date("2027-01-15T00:00:00.000Z");

  const result = resolveDeliverableState({
    status: "SCHEDULED",
    scheduledFor: future,
    publishedAt: null,
    paymentTermDays: 30,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.scheduledFor, future);
    assert.equal(result.value.publishedAt, null);
    assert.equal(result.value.paymentDueAt, null);
  }
});

test("agendar sin fecha no vale", () => {
  const result = resolveDeliverableState({
    status: "SCHEDULED",
    scheduledFor: null,
    publishedAt: null,
    paymentTermDays: 30,
  });

  assert.equal(result.ok, false);
});

test("publicar calcula el vencimiento desde la fecha de publicación", () => {
  const result = resolveDeliverableState({
    status: "PUBLISHED",
    scheduledFor: new Date("2026-09-01T00:00:00.000Z"),
    publishedAt: new Date("2026-09-05T00:00:00.000Z"),
    paymentTermDays: 30,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(
      result.value.paymentDueAt?.toISOString(),
      "2026-10-05T00:00:00.000Z"
    );
  }
});

test("si se publica sin fecha, se toma la prevista", () => {
  const result = resolveDeliverableState({
    status: "PUBLISHED",
    scheduledFor: new Date("2026-09-01T00:00:00.000Z"),
    publishedAt: null,
    paymentTermDays: 7,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(
      result.value.publishedAt?.toISOString(),
      "2026-09-01T00:00:00.000Z"
    );
    assert.equal(
      result.value.paymentDueAt?.toISOString(),
      "2026-09-08T00:00:00.000Z"
    );
  }
});

test("publicar sin ninguna fecha se rechaza", () => {
  const result = resolveDeliverableState({
    status: "PUBLISHED",
    scheduledFor: null,
    publishedAt: null,
    paymentTermDays: 30,
  });

  assert.equal(result.ok, false);
});

test("submitted conserva la publicación y deja pagar", () => {
  const publishedAt = new Date("2026-09-05T00:00:00.000Z");
  const result = resolveDeliverableState({
    status: "SUBMITTED",
    previousStatus: "PUBLISHED",
    scheduledFor: new Date("2026-09-01T00:00:00.000Z"),
    publishedAt,
    paymentTermDays: 30,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.status, "SUBMITTED");
    assert.equal(result.value.publishedAt, publishedAt);
    assert.equal(
      result.value.paymentDueAt?.toISOString(),
      "2026-10-05T00:00:00.000Z"
    );
  }
});

test("volver a sin agendar limpia todas las fechas", () => {
  const result = resolveDeliverableState({
    status: "PENDING",
    previousStatus: "SCHEDULED",
    scheduledFor: new Date("2026-09-01T00:00:00.000Z"),
    publishedAt: new Date("2026-09-02T00:00:00.000Z"),
    paymentTermDays: 30,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.status, "PENDING");
    assert.equal(result.value.scheduledFor, null);
    assert.equal(result.value.publishedAt, null);
    assert.equal(result.value.paymentDueAt, null);
  }
});

test("poner fecha prevista con el estado aún en sin agendar lo agenda", () => {
  const scheduledFor = new Date("2026-10-01T00:00:00.000Z");
  const result = resolveDeliverableState({
    status: "PENDING",
    previousStatus: "PENDING",
    scheduledFor,
    publishedAt: null,
    paymentTermDays: 30,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.status, "SCHEDULED");
    assert.equal(result.value.scheduledFor, scheduledFor);
  }
});

test("marca como retrasado lo agendado cuya fecha ya pasó", () => {
  const now = new Date("2026-09-17T00:00:00.000Z");

  assert.equal(
    isDeliverableLate(
      { status: "SCHEDULED", scheduledFor: new Date("2026-09-10T00:00:00.000Z") },
      now
    ),
    true
  );
  assert.equal(
    isDeliverableLate(
      { status: "SCHEDULED", scheduledFor: new Date("2026-09-30T00:00:00.000Z") },
      now
    ),
    false
  );
  assert.equal(
    isDeliverableLate(
      { status: "PUBLISHED", scheduledFor: new Date("2026-09-10T00:00:00.000Z") },
      now
    ),
    false
  );
  assert.equal(
    isDeliverableLate(
      { status: "SUBMITTED", scheduledFor: new Date("2026-09-10T00:00:00.000Z") },
      now
    ),
    false
  );
  assert.equal(
    isDeliverableLate({ status: "PENDING", scheduledFor: null }, now),
    false
  );
});

test("published está en redes y submitted es lo que se puede pagar", () => {
  assert.equal(isLiveDeliverable("PUBLISHED"), true);
  assert.equal(isLiveDeliverable("SUBMITTED"), true);
  assert.equal(isLiveDeliverable("SCHEDULED"), false);
  assert.equal(isPayableDeliverable("PUBLISHED"), false);
  assert.equal(isPayableDeliverable("SUBMITTED"), true);
});
