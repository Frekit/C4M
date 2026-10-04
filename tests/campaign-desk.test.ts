import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canActivateLine,
  canMarkClientDecision,
  canSendLineInWave,
  committedSaleCents,
  isClientDecisionStatus,
  lineQuoteComplete,
  quoteIsFrozen,
  requireBudgetSaleCents,
  statusAfterSavingQuote,
} from "@/lib/domain/campaign-desk";
import {
  CAMPAIGN_APPROVAL,
  CAMPAIGN_ENGAGEMENT,
  CAMPAIGN_TALENT_STATUS,
} from "@/lib/domain/enums";

const ready = {
  status: CAMPAIGN_TALENT_STATUS.READY,
  salePriceCentsPerContent: 25_000,
  costMinorPerContent: 8_000,
  costCurrency: "EUR",
  deliverableCount: 2,
};

test("una línea sin piezas o precios no está lista", () => {
  assert.equal(
    lineQuoteComplete({ ...ready, deliverableCount: null }),
    false
  );
  assert.equal(statusAfterSavingQuote(false), CAMPAIGN_TALENT_STATUS.ROSTER);
  assert.equal(statusAfterSavingQuote(true), CAMPAIGN_TALENT_STATUS.READY);
});

test("uso interno activa desde listo, no desde propuesto", () => {
  const policy = {
    approvalMode: CAMPAIGN_APPROVAL.INTERNAL,
    engagementKind: CAMPAIGN_ENGAGEMENT.ALWAYS_ON,
    budgetSaleCents: null,
  };
  assert.equal(canActivateLine(ready, policy, []).ok, true);
  assert.equal(
    canActivateLine(
      { ...ready, status: CAMPAIGN_TALENT_STATUS.PROPOSED },
      policy,
      []
    ).ok,
    false
  );
});

test("si el cliente aprueba, solo se activa lo aprobado", () => {
  const policy = {
    approvalMode: CAMPAIGN_APPROVAL.CLIENT_APPROVES,
    engagementKind: CAMPAIGN_ENGAGEMENT.SLATE,
    budgetSaleCents: null,
  };
  assert.equal(canActivateLine(ready, policy, []).ok, false);
  assert.equal(
    canActivateLine(
      { ...ready, status: CAMPAIGN_TALENT_STATUS.APPROVED },
      policy,
      []
    ).ok,
    true
  );
});

test("un presupuesto de 50K bloquea la línea que se pasa", () => {
  const policy = {
    approvalMode: CAMPAIGN_APPROVAL.INTERNAL,
    engagementKind: CAMPAIGN_ENGAGEMENT.BUDGET,
    budgetSaleCents: 50_000_00,
  };
  const sibling = {
    ...ready,
    status: CAMPAIGN_TALENT_STATUS.ACTIVE,
    salePriceCentsPerContent: 40_000_00,
    deliverableCount: 1,
  };
  assert.equal(committedSaleCents([sibling]), 40_000_00);
  const over = canActivateLine(
    { ...ready, salePriceCentsPerContent: 20_000_00, deliverableCount: 1 },
    policy,
    [sibling]
  );
  assert.equal(over.ok, false);
  const fits = canActivateLine(
    { ...ready, salePriceCentsPerContent: 5_000_00, deliverableCount: 1 },
    policy,
    [sibling]
  );
  assert.equal(fits.ok, true);
});

test("a una oleada solo entra una línea lista", () => {
  assert.equal(canSendLineInWave(ready), true);
  assert.equal(
    canSendLineInWave({ ...ready, deliverableCount: null }),
    false
  );
});

test("un presupuesto sin importe no se puede activar", () => {
  const policy = {
    approvalMode: CAMPAIGN_APPROVAL.INTERNAL,
    engagementKind: CAMPAIGN_ENGAGEMENT.BUDGET,
    budgetSaleCents: null,
  };
  assert.equal(canActivateLine(ready, policy, []).ok, false);
  assert.equal(requireBudgetSaleCents(CAMPAIGN_ENGAGEMENT.BUDGET, "").ok, false);
  assert.equal(requireBudgetSaleCents(CAMPAIGN_ENGAGEMENT.BUDGET, "50").ok, true);
});

test("la cotización se congela al enviar, aprobar o activar", () => {
  assert.equal(quoteIsFrozen(CAMPAIGN_TALENT_STATUS.READY), false);
  assert.equal(quoteIsFrozen(CAMPAIGN_TALENT_STATUS.PROPOSED), true);
  assert.equal(quoteIsFrozen(CAMPAIGN_TALENT_STATUS.APPROVED), true);
  assert.equal(quoteIsFrozen(CAMPAIGN_TALENT_STATUS.ACTIVE), true);
});

test("el ok de cliente solo vale sobre una oleada enviada", () => {
  assert.equal(
    canMarkClientDecision(
      CAMPAIGN_APPROVAL.CLIENT_APPROVES,
      CAMPAIGN_TALENT_STATUS.READY
    ),
    false
  );
  assert.equal(
    canMarkClientDecision(
      CAMPAIGN_APPROVAL.CLIENT_APPROVES,
      CAMPAIGN_TALENT_STATUS.PROPOSED
    ),
    true
  );
  assert.equal(isClientDecisionStatus(CAMPAIGN_TALENT_STATUS.ACTIVE), false);
  assert.equal(isClientDecisionStatus(CAMPAIGN_TALENT_STATUS.APPROVED), true);
});
