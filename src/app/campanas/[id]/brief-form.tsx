"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  saveCampaignBrief,
  type CampaignTalkResult,
} from "@/app/campanas/curation-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const field =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

export function CampaignBriefForm({
  campaignId,
  canWrite,
  objective,
  audience,
  networks,
  formats,
  notes,
}: {
  campaignId: string;
  canWrite: boolean;
  objective: string | null;
  audience: string | null;
  networks: string | null;
  formats: string | null;
  notes: string | null;
}) {
  const [state, action, pending] = useActionState<CampaignTalkResult | null, FormData>(
    saveCampaignBrief,
    null
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success("Brief guardado.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brief</CardTitle>
        <CardDescription>
          Lo usa el equipo al elegir perfiles y en el hilo. El cliente lo ve, no lo edita.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {canWrite ? (
          <form action={action} className="grid gap-3">
            <input type="hidden" name="campaignId" value={campaignId} />
            <label className="grid gap-1">
              <Label htmlFor="briefObjective">Objetivo</Label>
              <input
                id="briefObjective"
                name="briefObjective"
                defaultValue={objective ?? ""}
                className={field}
                placeholder="Lanzar el plan anual en España"
              />
            </label>
            <label className="grid gap-1">
              <Label htmlFor="briefAudience">Audiencia</Label>
              <input
                id="briefAudience"
                name="briefAudience"
                defaultValue={audience ?? ""}
                className={field}
                placeholder="Creators de tecnología, 20-35"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <Label htmlFor="briefNetworks">Redes</Label>
                <input
                  id="briefNetworks"
                  name="briefNetworks"
                  defaultValue={networks ?? ""}
                  className={field}
                  placeholder="Instagram, TikTok"
                />
              </label>
              <label className="grid gap-1">
                <Label htmlFor="briefFormats">Formatos</Label>
                <input
                  id="briefFormats"
                  name="briefFormats"
                  defaultValue={formats ?? ""}
                  className={field}
                  placeholder="Reels y vídeos"
                />
              </label>
            </div>
            <label className="grid gap-1">
              <Label htmlFor="briefNotes">Notas</Label>
              <Textarea
                id="briefNotes"
                name="briefNotes"
                defaultValue={notes ?? ""}
                rows={3}
                placeholder="Lo que el cliente ya dijo y no queremos volver a preguntar."
              />
            </label>
            <div>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Guardando…" : "Guardar brief"}
              </Button>
            </div>
          </form>
        ) : (
          <BriefRead
            objective={objective}
            audience={audience}
            networks={networks}
            formats={formats}
            notes={notes}
          />
        )}
      </CardContent>
    </Card>
  );
}

export function BriefRead({
  objective,
  audience,
  networks,
  formats,
  notes,
}: {
  objective: string | null;
  audience: string | null;
  networks: string | null;
  formats: string | null;
  notes: string | null;
}) {
  const rows = [
    ["Objetivo", objective],
    ["Audiencia", audience],
    ["Redes", networks],
    ["Formatos", formats],
    ["Notas", notes],
  ].filter((row) => row[1]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay brief. La agencia lo escribe cuando el encargo está claro.
      </p>
    );
  }

  return (
    <dl className="grid gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-0.5">
          <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </dt>
          <dd className="text-sm leading-relaxed whitespace-pre-wrap">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
