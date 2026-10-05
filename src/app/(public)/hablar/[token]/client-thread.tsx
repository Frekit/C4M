"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  postClientMessage,
  type CampaignTalkResult,
} from "@/app/(app)/campanas/curation-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ClientThreadForm({
  token,
  messages,
}: {
  token: string;
  messages: {
    id: string;
    authorKind: string;
    authorLabel: string;
    body: string;
  }[];
}) {
  const [state, action, pending] = useActionState<CampaignTalkResult | null, FormData>(
    postClientMessage,
    null
  );
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Mensaje enviado.");
      setEpoch((value) => value + 1);
    } else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <div className="grid gap-4">
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay mensajes. Escribe cuando quieras y la agencia lo ve
          en la misma conversación.
        </p>
      ) : (
        <ol className="grid gap-2">
          {messages.map((message) => (
            <li
              key={message.id}
              className={
                message.authorKind === "CLIENT"
                  ? "ml-8 rounded-xl bg-primary px-3 py-2 text-primary-foreground"
                  : "mr-8 rounded-xl border bg-card px-3 py-2"
              }
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] opacity-70">
                {message.authorKind === "ASSISTANT"
                  ? "Mesa"
                  : message.authorKind === "CLIENT"
                    ? message.authorLabel
                    : "Agencia"}
              </p>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
                {message.body}
              </p>
            </li>
          ))}
        </ol>
      )}

      <form key={epoch} action={action} className="grid gap-3">
        <input type="hidden" name="token" value={token} />
        <label className="grid gap-1">
          <Label htmlFor="client-name">Tu nombre</Label>
          <Input id="client-name" name="name" placeholder="Ana, de la marca" />
        </label>
        <label className="grid gap-1">
          <Label htmlFor="client-body">Mensaje</Label>
          <Textarea
            id="client-body"
            name="body"
            rows={4}
            placeholder="Lo que queráis cambiar o confirmar."
            required
          />
        </label>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Enviando…" : "Enviar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
