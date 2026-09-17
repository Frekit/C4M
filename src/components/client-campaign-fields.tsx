"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
  SETTLEMENT_MODE,
  SETTLEMENT_MODE_LABELS,
  type SettlementMode,
} from "@/lib/domain/enums";

export type ClientOption = {
  id: string;
  name: string;
  settlementMode: string;
  requiresPlatformSubmit: boolean;
};

export type CampaignChoice = {
  id: string;
  name: string;
  clientId: string | null;
};

const selectClass =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function ClientCampaignFields({
  clients,
  campaigns,
  defaultClientId,
  defaultCampaignId,
  lockClient = false,
  clientError,
  campaignError,
}: {
  clients: ClientOption[];
  campaigns: CampaignChoice[];
  defaultClientId?: string;
  defaultCampaignId?: string;
  lockClient?: boolean;
  clientError?: string;
  campaignError?: string;
}) {
  const [clientId, setClientId] = useState(
    defaultClientId ?? clients[0]?.id ?? ""
  );
  const client = clients.find((item) => item.id === clientId);
  const campaignsForClient = campaigns.filter(
    (campaign) => campaign.clientId === clientId
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="clientId">Cliente</Label>
        {lockClient ? (
          <>
            <input type="hidden" name="clientId" value={clientId} />
            <p className="h-8 content-center text-sm font-medium">
              {client?.name ?? "Cliente"}
            </p>
          </>
        ) : (
          <select
            id="clientId"
            name="clientId"
            required
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            aria-invalid={Boolean(clientError)}
            className={selectClass}
          >
            {clients.length === 0 ? (
              <option value="">Crea un cliente en Campañas</option>
            ) : null}
            {clients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ·{" "}
                {SETTLEMENT_MODE_LABELS[item.settlementMode as SettlementMode] ??
                  item.settlementMode}
              </option>
            ))}
          </select>
        )}
        {clientError ? (
          <p className="text-xs text-destructive">{clientError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {client?.settlementMode === SETTLEMENT_MODE.PACK
              ? "Se cobra y se paga cuando este perfil cierra el pack de la campaña."
              : client?.requiresPlatformSubmit
                ? "Cada pieza se sube a plataforma y se liquida por separado."
                : "Un contrato es de un solo cliente. Higgsfield y Many Chat no se mezclan."}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="campaignId">Campaña (opcional)</Label>
        <select
          key={clientId}
          id="campaignId"
          name="campaignId"
          defaultValue={
            campaignsForClient.some((item) => item.id === defaultCampaignId)
              ? defaultCampaignId
              : ""
          }
          aria-invalid={Boolean(campaignError)}
          className={selectClass}
        >
          <option value="">Sin campaña todavía</option>
          {campaignsForClient.map((campaign) => (
            <option key={campaign.id} value={campaign.id}>
              {campaign.name}
            </option>
          ))}
        </select>
        {campaignError ? (
          <p className="text-xs text-destructive">{campaignError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Solo campañas de este cliente. Puedes asignarla después en
            Contenidos.
          </p>
        )}
      </div>
    </div>
  );
}
