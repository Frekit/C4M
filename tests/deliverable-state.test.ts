import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isDeliverableLate,
  isLiveDeliverable,
  resolveDeliverableState,
} from "@/lib/domain/rules";
import { isPayableWithPolicy } from "@/lib/domain/settlement";

test("agendar admite fechas futuras y no devenga nada", () => {
  const future = new Date("2027-01-15T00:00:00.000Z");

  const result = resolveDeliverableState({
    status: "SCHEDULED",
    contentDate: future,
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
    contentDate: null,
    paymentTermDays: 30,
  });

  assert.equal(result.ok, false);
});

test("publicar calcula el vencimiento desde la fecha", () => {
  const contentDate = new Date("2026-09-05T00:00:00.000Z");
  const result = resolveDeliverableState({
    status: "PUBLISHED",
    contentDate,
    postUrl: "https://instagram.com/p/abc",
    paymentTermDays: 30,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.scheduledFor, contentDate);
    assert.equal(result.value.publishedAt, contentDate);
    assert.equal(
      result.value.paymentDueAt?.toISOString(),
      "2026-10-05T00:00:00.000Z"
    );
  }
});

test("publicar sin fecha se rechaza", () => {
  const result = resolveDeliverableState({
    status: "PUBLISHED",
    contentDate: null,
    postUrl: "https://instagram.com/p/abc",
    paymentTermDays: 30,
  });

  assert.equal(result.ok, false);
});

test("publicar sin enlace se rechaza", () => {
  const result = resolveDeliverableState({
    status: "PUBLISHED",
    contentDate: new Date("2026-09-05T00:00:00.000Z"),
    postUrl: "",
    paymentTermDays: 30,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /enlace/);
  }
});

test("submitted conserva la fecha unificada y deja pagar", () => {
  const contentDate = new Date("2026-09-05T00:00:00.000Z");
  const result = resolveDeliverableState({
    status: "SUBMITTED",
    previousStatus: "PUBLISHED",
    contentDate,
    postUrl: "https://instagram.com/p/abc",
    paymentTermDays: 30,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.status, "SUBMITTED");
    assert.equal(result.value.publishedAt, contentDate);
    assert.equal(result.value.scheduledFor, contentDate);
    assert.equal(
      result.value.paymentDueAt?.toISOString(),
      "2026-10-05T00:00:00.000Z"
    );
  }
});

test("submitted sin enlace se rechaza", () => {
  const result = resolveDeliverableState({
    status: "SUBMITTED",
    previousStatus: "PUBLISHED",
    contentDate: new Date("2026-09-05T00:00:00.000Z"),
    paymentTermDays: 30,
  });

  assert.equal(result.ok, false);
});

test("volver a sin agendar limpia la fecha", () => {
  const result = resolveDeliverableState({
    status: "PENDING",
    previousStatus: "SCHEDULED",
    contentDate: new Date("2026-09-01T00:00:00.000Z"),
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

test("poner fecha con el estado aún en sin agendar lo agenda", () => {
  const contentDate = new Date("2026-10-01T00:00:00.000Z");
  const result = resolveDeliverableState({
    status: "PENDING",
    previousStatus: "PENDING",
    contentDate,
    paymentTermDays: 30,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.status, "SCHEDULED");
    assert.equal(result.value.scheduledFor, contentDate);
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

test("published está en redes; pagar al perfil lo decide la política de liquidación", () => {
  const higgsfield = {
    settlementMode: "PER_CONTENT",
    requiresPlatformSubmit: true,
  };

  assert.equal(isLiveDeliverable("PUBLISHED"), true);
  assert.equal(isLiveDeliverable("SUBMITTED"), true);
  assert.equal(isLiveDeliverable("SCHEDULED"), false);
  assert.equal(isPayableWithPolicy("PUBLISHED", higgsfield, false), false);
  assert.equal(isPayableWithPolicy("SUBMITTED", higgsfield, false), true);
});
