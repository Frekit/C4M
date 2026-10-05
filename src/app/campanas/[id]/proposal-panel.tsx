"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  addTalentToProposal,
  createCampaignProposal,
  sendCampaignProposal,
  type CampaignRosterResult,
} from "@/app/campanas/roster-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CampaignProposalRow } from "@/lib/domain/campaign-roster";
import {
  CAMPAIGN_APPROVAL,
  PROPOSAL_STATUS_LABELS,
  type CampaignApproval,
  type ProposalStatus,
} from "@/lib/domain/enums";

function toastResult(state: CampaignRosterResult | null) {
  if (!state) return;
  if (state.ok) toast.success("Oleada actualizada.");
  else if (state.error) toast.error(state.error);
}

export function CampaignProposalPanel({
  campaignId,
  canWrite,
  approvalMode,
  proposals,
}: {
  campaignId: string;
  canWrite: boolean;
  approvalMode: CampaignApproval;
  proposals: CampaignProposalRow[];
}) {
  const [state, formAction, pending] = useActionState<
    CampaignRosterResult | null,
    FormData
  >(createCampaignProposal, null);

  useEffect(() => toastResult(state), [state]);

  const clientSees = approvalMode === CAMPAIGN_APPROVAL.CLIENT_APPROVES;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Oleadas</CardTitle>
        <CardDescription>
          Un lote de 1 o 50 perfiles. Marcar enviada deja constancia de que el
          equipo cerró el lote. El cliente no entra aquí: si hay que hablar, es
          en el hilo.
          {clientSees
            ? ""
            : " En esta campaña el contrato sale de la línea lista, sin ese registro."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {canWrite ? (
          <form action={formAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="campaignId" value={campaignId} />
            <div className="grid gap-1">
              <Label htmlFor="proposal-title" className="text-xs">
                Nueva oleada
              </Label>
              <Input
                id="proposal-title"
                name="title"
                placeholder="Mayo · 12 perfiles"
                className="w-56"
              />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "…" : "Crear oleada"}
            </Button>
          </form>
        ) : null}

        {proposals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay oleadas. No hace falta si trabajáis perfil a perfil.
          </p>
        ) : (
          <ul className="grid gap-2">
            {proposals.map((proposal) => (
              <li
                key={proposal.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{proposal.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {proposal.talentIds.length}{" "}
                    {proposal.talentIds.length === 1 ? "perfil" : "perfiles"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {PROPOSAL_STATUS_LABELS[proposal.status as ProposalStatus]}
                  </Badge>
                  {canWrite &&
                  clientSees &&
                  proposal.status === "DRAFT" &&
                  proposal.talentIds.length > 0 ? (
                    <form action={sendCampaignProposal}>
                      <input
                        type="hidden"
                        name="proposalId"
                        value={proposal.id}
                      />
                      <Button type="submit" size="sm">
                        Marcar enviada
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function AddToProposalForm({
  talentId,
  drafts,
}: {
  talentId: string;
  drafts: CampaignProposalRow[];
}) {
  if (drafts.length === 0) return null;
  return (
    <form action={addTalentToProposal} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="talentId" value={talentId} />
      <select
        name="proposalId"
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
      >
        {drafts.map((proposal) => (
          <option key={proposal.id} value={proposal.id}>
            {proposal.title}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline">
        Meter en oleada
      </Button>
    </form>
  );
}
