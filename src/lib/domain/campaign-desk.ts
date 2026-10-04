import {
  CAMPAIGN_APPROVAL,
  CAMPAIGN_ENGAGEMENT,
  CAMPAIGN_TALENT_STATUS,
  PROPOSAL_STATUS,
  type CampaignApproval,
  type CampaignEngagement,
  type CampaignTalentStatus,
  type ProposalStatus,
} from "@/lib/domain/enums";

export const OPEN_TALENT_STATUSES: CampaignTalentStatus[] = [
  CAMPAIGN_TALENT_STATUS.ROSTER,
  CAMPAIGN_TALENT_STATUS.READY,
  CAMPAIGN_TALENT_STATUS.PROPOSED,
  CAMPAIGN_TALENT_STATUS.APPROVED,
];

export const TALENT_STATUS_RANK: Record<CampaignTalentStatus, number> = {
  [CAMPAIGN_TALENT_STATUS.REJECTED]: 0,
  [CAMPAIGN_TALENT_STATUS.ROSTER]: 1,
  [CAMPAIGN_TALENT_STATUS.READY]: 2,
  [CAMPAIGN_TALENT_STATUS.PROPOSED]: 3,
  [CAMPAIGN_TALENT_STATUS.APPROVED]: 4,
  [CAMPAIGN_TALENT_STATUS.ACTIVE]: 5,
};

export type CampaignPolicy = {
  engagementKind: CampaignEngagement;
  approvalMode: CampaignApproval;
  budgetSaleCents: number | null;
  defaultPaymentTermDays: number;
};

export type CampaignLineQuote = {
  status: string;
  salePriceCentsPerContent: number | null;
  costMinorPerContent: number | null;
  costCurrency: string | null;
  deliverableCount: number | null;
};

export function isCampaignEngagement(
  value: string
): value is CampaignEngagement {
  return Object.values(CAMPAIGN_ENGAGEMENT).includes(
    value as CampaignEngagement
  );
}

export function isCampaignApproval(value: string): value is CampaignApproval {
  return Object.values(CAMPAIGN_APPROVAL).includes(value as CampaignApproval);
}

export function isProposalStatus(value: string): value is ProposalStatus {
  return Object.values(PROPOSAL_STATUS).includes(value as ProposalStatus);
}

export function lineQuoteComplete(line: CampaignLineQuote) {
  return (
    (line.deliverableCount ?? 0) >= 1 &&
    line.salePriceCentsPerContent != null &&
    line.salePriceCentsPerContent > 0 &&
    line.costMinorPerContent != null &&
    line.costMinorPerContent > 0 &&
    Boolean(line.costCurrency)
  );
}

export function lineSaleCents(line: CampaignLineQuote) {
  if (
    line.salePriceCentsPerContent == null ||
    !line.deliverableCount ||
    line.deliverableCount < 1
  ) {
    return 0;
  }
  return line.salePriceCentsPerContent * line.deliverableCount;
}

export function statusAfterSavingQuote(complete: boolean): CampaignTalentStatus {
  return complete ? CAMPAIGN_TALENT_STATUS.READY : CAMPAIGN_TALENT_STATUS.ROSTER;
}

const COMMITTED_STATUSES = new Set<string>([
  CAMPAIGN_TALENT_STATUS.PROPOSED,
  CAMPAIGN_TALENT_STATUS.APPROVED,
  CAMPAIGN_TALENT_STATUS.ACTIVE,
]);

export function committedSaleCents(lines: CampaignLineQuote[]) {
  return lines
    .filter((line) => COMMITTED_STATUSES.has(line.status))
    .reduce((sum, line) => sum + lineSaleCents(line), 0);
}

export function budgetRemainingCents(
  policy: Pick<CampaignPolicy, "engagementKind" | "budgetSaleCents">,
  lines: CampaignLineQuote[]
) {
  if (
    policy.engagementKind !== CAMPAIGN_ENGAGEMENT.BUDGET ||
    policy.budgetSaleCents == null
  ) {
    return null;
  }
  return policy.budgetSaleCents - committedSaleCents(lines);
}

export function canActivateLine(
  line: CampaignLineQuote,
  policy: Pick<CampaignPolicy, "approvalMode" | "engagementKind" | "budgetSaleCents">,
  siblings: CampaignLineQuote[]
): { ok: true } | { ok: false; error: string } {
  if (!lineQuoteComplete(line)) {
    return {
      ok: false,
      error: "Guarda piezas, venta y coste antes de activar.",
    };
  }

  if (policy.approvalMode === CAMPAIGN_APPROVAL.CLIENT_APPROVES) {
    if (line.status !== CAMPAIGN_TALENT_STATUS.APPROVED) {
      return {
        ok: false,
        error: "Este cliente aprueba perfiles. Espera el ok o márcalo aprobado.",
      };
    }
  } else if (
    line.status !== CAMPAIGN_TALENT_STATUS.READY &&
    line.status !== CAMPAIGN_TALENT_STATUS.APPROVED
  ) {
    return {
      ok: false,
      error: "La línea tiene que estar lista para activarla.",
    };
  }

  if (policy.engagementKind === CAMPAIGN_ENGAGEMENT.BUDGET) {
    if (policy.budgetSaleCents == null || policy.budgetSaleCents <= 0) {
      return {
        ok: false,
        error: "Esta campaña de presupuesto no tiene tope. Pon el importe.",
      };
    }
    const others = siblings.filter((item) => item !== line);
    const remaining = budgetRemainingCents(policy, others);
    if (remaining != null && lineSaleCents(line) > remaining) {
      return {
        ok: false,
        error: "Esta línea se pasa del presupuesto de la campaña.",
      };
    }
  }

  return { ok: true };
}

export function canSendLineInWave(line: CampaignLineQuote) {
  return (
    lineQuoteComplete(line) &&
    (line.status === CAMPAIGN_TALENT_STATUS.READY ||
      line.status === CAMPAIGN_TALENT_STATUS.ROSTER)
  );
}

export function canMarkClientDecision(
  approvalMode: CampaignApproval,
  status: string
) {
  if (approvalMode !== CAMPAIGN_APPROVAL.CLIENT_APPROVES) return false;
  return (
    status === CAMPAIGN_TALENT_STATUS.PROPOSED ||
    status === CAMPAIGN_TALENT_STATUS.APPROVED
  );
}

const FROZEN_QUOTE_STATUSES = new Set<string>([
  CAMPAIGN_TALENT_STATUS.PROPOSED,
  CAMPAIGN_TALENT_STATUS.APPROVED,
  CAMPAIGN_TALENT_STATUS.ACTIVE,
]);

export function quoteIsFrozen(status: string) {
  return FROZEN_QUOTE_STATUSES.has(status);
}

export function isClientDecisionStatus(status: string) {
  return (
    status === CAMPAIGN_TALENT_STATUS.APPROVED ||
    status === CAMPAIGN_TALENT_STATUS.REJECTED
  );
}

export function requireBudgetSaleCents(
  engagementKind: string,
  raw: string | null | undefined
): { ok: true; cents: number | null } | { ok: false; error: string } {
  if (engagementKind !== CAMPAIGN_ENGAGEMENT.BUDGET) {
    return { ok: true, cents: null };
  }
  const cents = parseBudgetUsd(raw);
  if (cents == null || cents <= 0) {
    return { ok: false, error: "Pon el presupuesto en USD." };
  }
  return { ok: true, cents };
}

export function parseBudgetUsd(raw: string | null | undefined) {
  const text = raw?.trim() ?? "";
  if (!text) return null;
  const normalized = Number(text.replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(normalized) || normalized <= 0) return null;
  const cents = Math.round(normalized * 100);
  return cents > 0 ? cents : null;
}

export function parsePaymentTermDays(raw: string | null | undefined) {
  const days = Number.parseInt(raw?.trim() ?? "", 10);
  return Number.isFinite(days) && days >= 0 ? days : 30;
}

export function policyFromCampaign(campaign: {
  engagementKind?: string | null;
  approvalMode?: string | null;
  budgetSaleCents?: number | null;
  defaultPaymentTermDays?: number | null;
}): CampaignPolicy {
  const rawEngagement = campaign.engagementKind ?? "";
  const rawApproval = campaign.approvalMode ?? "";
  const engagement = isCampaignEngagement(rawEngagement)
    ? rawEngagement
    : CAMPAIGN_ENGAGEMENT.ALWAYS_ON;
  const approval = isCampaignApproval(rawApproval)
    ? rawApproval
    : CAMPAIGN_APPROVAL.INTERNAL;
  return {
    engagementKind: engagement,
    approvalMode: approval,
    budgetSaleCents: campaign.budgetSaleCents ?? null,
    defaultPaymentTermDays:
      campaign.defaultPaymentTermDays && campaign.defaultPaymentTermDays > 0
        ? campaign.defaultPaymentTermDays
        : 30,
  };
}
