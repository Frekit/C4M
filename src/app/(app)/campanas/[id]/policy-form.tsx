"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  updateCampaignPolicy,
  type CampaignActionResult,
} from "@/app/(app)/campanas/actions";
import { CampaignPolicyFields } from "@/app/(app)/campanas/campaign-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CAMPAIGN_APPROVAL_LABELS,
  CAMPAIGN_ENGAGEMENT_LABELS,
  type CampaignApproval,
  type CampaignEngagement,
} from "@/lib/domain/enums";
import { formatMoney } from "@/lib/money";

export function CampaignPolicyCard({
  campaignId,
  canWrite,
  engagementKind,
  approvalMode,
  budgetSaleCents,
  defaultPaymentTermDays,
  committedCents,
}: {
  campaignId: string;
  canWrite: boolean;
  engagementKind: CampaignEngagement;
  approvalMode: CampaignApproval;
  budgetSaleCents: number | null;
  defaultPaymentTermDays: number;
  committedCents: number;
}) {
  const remaining =
    budgetSaleCents != null ? budgetSaleCents - committedCents : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cómo trabaja esta campaña</CardTitle>
        <CardDescription>
          {CAMPAIGN_ENGAGEMENT_LABELS[engagementKind]} ·{" "}
          {CAMPAIGN_APPROVAL_LABELS[approvalMode]}
          {budgetSaleCents != null
            ? ` · sobre ${formatMoney(budgetSaleCents, "USD")} · comprometido ${formatMoney(committedCents, "USD")}${
                remaining != null
                  ? ` · queda ${formatMoney(remaining, "USD")}`
                  : ""
              }`
            : ""}
        </CardDescription>
      </CardHeader>
      {canWrite ? (
        <CardContent>
          <PolicyForm
            campaignId={campaignId}
            engagementKind={engagementKind}
            approvalMode={approvalMode}
            budgetSaleCents={budgetSaleCents}
            defaultPaymentTermDays={defaultPaymentTermDays}
          />
        </CardContent>
      ) : null}
    </Card>
  );
}

function PolicyForm({
  campaignId,
  engagementKind,
  approvalMode,
  budgetSaleCents,
  defaultPaymentTermDays,
}: {
  campaignId: string;
  engagementKind: CampaignEngagement;
  approvalMode: CampaignApproval;
  budgetSaleCents: number | null;
  defaultPaymentTermDays: number;
}) {
  const [state, formAction, pending] = useActionState<
    CampaignActionResult | null,
    FormData
  >(updateCampaignPolicy, null);

  useEffect(() => {
    if (state?.ok) toast.success("Política de campaña actualizada.");
    if (state && !state.ok && state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="campaignId" value={campaignId} />
      <CampaignPolicyFields
        idPrefix="edit-"
        engagementKind={engagementKind}
        approvalMode={approvalMode}
        budgetUsd={
          budgetSaleCents != null ? String(budgetSaleCents / 100) : ""
        }
        paymentTermDays={defaultPaymentTermDays}
      />
      <Button type="submit" size="sm" className="w-fit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar política"}
      </Button>
    </form>
  );
}
