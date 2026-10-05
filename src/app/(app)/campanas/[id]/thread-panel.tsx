"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  applyAssistantDraft,
  askAssistant,
  dismissAssistantDraft,
  ensureClientTalkLink,
  postAgencyMessage,
  type CampaignTalkResult,
} from "@/app/(app)/campanas/curation-actions";
import type { CampaignRosterResult } from "@/app/(app)/campanas/roster-actions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { handlesFromDraft } from "@/lib/domain/campaign-briefing";

export type TalkMessage = {
  id: string;
  authorKind: string;
  authorLabel: string;
  body: string;
  visibility: string;
  createdAt: string;
};

function isClientVisible(message: TalkMessage) {
  return message.visibility === "SHARED" || message.authorKind === "CLIENT";
}

function toastTalk(state: CampaignTalkResult | CampaignRosterResult | null, ok: string) {
  if (!state) return;
  if (state.ok) toast.success(ok);
  else if (state.error) toast.error(state.error);
}

function openDraft(messages: TalkMessage[]) {
  let draft: TalkMessage | null = null;
  for (const message of messages) {
    if (
      message.authorKind === "ASSISTANT" &&
      handlesFromDraft(message.body).length > 0
    ) {
      draft = message;
      continue;
    }
    if (draft && message.createdAt >= draft.createdAt && message.id !== draft.id) {
      draft = null;
    }
  }
  return draft;
}

export function CampaignThread({
  campaignId,
  canWrite,
  messages,
  statusLine,
  onDesk,
  priced,
  active,
  published,
  total,
  remainingLabel,
  budgetLabel,
  talkUrl,
}: {
  campaignId: string;
  canWrite: boolean;
  messages: TalkMessage[];
  statusLine: string;
  onDesk: number;
  priced: number;
  active: number;
  published: number;
  total: number;
  remainingLabel: string | null;
  budgetLabel: string | null;
  talkUrl: string | null;
}) {
  const [askState, askAction, askPending] = useActionState<
    CampaignTalkResult | null,
    FormData
  >(askAssistant, null);
  const [noteState, noteAction, notePending] = useActionState<
    CampaignTalkResult | null,
    FormData
  >(postAgencyMessage, null);
  const [linkState, linkAction, linkPending] = useActionState<
    CampaignTalkResult | null,
    FormData
  >(ensureClientTalkLink, null);
  const [applyState, applyAction, applyPending] = useActionState<
    CampaignRosterResult | null,
    FormData
  >(applyAssistantDraft, null);
  const [dismissState, dismissAction, dismissPending] = useActionState<
    CampaignTalkResult | null,
    FormData
  >(dismissAssistantDraft, null);
  const [askEpoch, setAskEpoch] = useState(0);
  const [noteEpoch, setNoteEpoch] = useState(0);
  const [visibleToClient, setVisibleToClient] = useState(false);
  const [seenAsk, setSeenAsk] = useState(askState);
  const [seenNote, setSeenNote] = useState(noteState);

  if (askState !== seenAsk) {
    setSeenAsk(askState);
    if (askState?.ok) setAskEpoch((epoch) => epoch + 1);
  }
  if (noteState !== seenNote) {
    setSeenNote(noteState);
    if (noteState?.ok) {
      setNoteEpoch((epoch) => epoch + 1);
      setVisibleToClient(false);
    }
  }

  useEffect(() => {
    toastTalk(askState, "La mesa respondió.");
  }, [askState]);
  useEffect(() => {
    toastTalk(noteState, "Nota en el hilo.");
  }, [noteState]);
  useEffect(() => toastTalk(linkState, "Enlace listo."), [linkState]);
  useEffect(() => toastTalk(applyState, "Borrador en la mesa."), [applyState]);
  useEffect(() => toastTalk(dismissState, "Borrador dejado."), [dismissState]);

  const shownLink =
    talkUrl ?? (linkState?.token ? `/hablar/${linkState.token}` : null);
  const teamMessages = messages.filter((message) => !isClientVisible(message));
  const clientMessages = messages.filter((message) => isClientVisible(message));
  const draft = openDraft(teamMessages);

  return (
    <aside className="grid gap-3 lg:sticky lg:top-4">
      <section className="rounded-xl border bg-card p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Estado
        </p>
        <p className="mt-2 text-sm leading-relaxed">{statusLine}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <Stat label="En mesa" value={String(onDesk)} />
          <Stat label="Con precio" value={String(priced)} />
          <Stat label="Activos" value={String(active)} />
          <Stat label="Publicados" value={`${published}/${total}`} />
        </dl>
        {remainingLabel && budgetLabel ? (
          <p className="mt-3 text-sm tabular-nums">
            Quedan {remainingLabel} de {budgetLabel}
          </p>
        ) : null}
      </section>

      <section
        tabIndex={0}
        aria-label="Hilo de la campaña"
        className="grid max-h-[32rem] gap-3 overflow-y-auto rounded-xl border bg-card p-4"
      >
        <Tabs defaultValue="equipo">
          <TabsList>
            <TabsTrigger value="equipo">Equipo</TabsTrigger>
            <TabsTrigger value="cliente">Con el cliente</TabsTrigger>
          </TabsList>
          <TabsContent value="equipo">
            <MessageList
              messages={teamMessages}
              empty="La mesa y las notas internas se quedan aquí. El cliente no las ve."
            />
          </TabsContent>
          <TabsContent value="cliente">
            <MessageList
              messages={clientMessages}
              empty="Aquí solo entra lo que marcas como visible y lo que responde el cliente."
            />
          </TabsContent>
        </Tabs>
      </section>

      {draft && canWrite ? (
        <div className="grid gap-2 rounded-xl border border-dashed bg-card p-3">
          <p className="text-sm">Hay un borrador sin aplicar.</p>
          <div className="flex flex-wrap gap-2">
            <form action={applyAction}>
              <input type="hidden" name="campaignId" value={campaignId} />
              <input type="hidden" name="messageId" value={draft.id} />
              <Button type="submit" size="sm" disabled={applyPending}>
                {applyPending ? "Aplicando…" : "Aplicar borrador"}
              </Button>
            </form>
            <form action={dismissAction}>
              <input type="hidden" name="campaignId" value={campaignId} />
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                disabled={dismissPending}
              >
                Descartar borrador
              </Button>
            </form>
          </div>
        </div>
      ) : null}

      {canWrite ? (
        <form key={`pregunta-${askEpoch}`} action={askAction} className="grid gap-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <Textarea
            name="question"
            rows={3}
            placeholder="Pide un plan o pregunta qué hay en la mesa."
          />
          <div>
            <Button type="submit" size="sm" disabled={askPending}>
              {askPending ? "Leyendo la mesa…" : "Preguntar a la mesa"}
            </Button>
          </div>
        </form>
      ) : null}

      {canWrite ? (
        <form key={`nota-${noteEpoch}`} action={noteAction} className="grid gap-2">
          <input type="hidden" name="campaignId" value={campaignId} />
          <Textarea
            name="body"
            rows={2}
            placeholder={
              visibleToClient ? "Mensaje para el cliente" : "Nota para el equipo"
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="visibleToClient"
              value="1"
              checked={visibleToClient}
              onChange={(event) => setVisibleToClient(event.target.checked)}
              className="size-4 accent-primary"
            />
            Visible para el cliente
          </label>
          {visibleToClient ? (
            <p className="text-xs text-muted-foreground">El cliente verá esto.</p>
          ) : null}
          <div>
            <Button type="submit" size="sm" variant="outline" disabled={notePending}>
              {notePending ? "Enviando…" : "Escribir en el hilo"}
            </Button>
          </div>
        </form>
      ) : null}

      <section className="rounded-xl border bg-card p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Enlace del cliente
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Habla en el mismo hilo. No ve la mesa, los costes ni botones de estado.
        </p>
        {shownLink ? (
          <a
            href={shownLink}
            className="mt-2 block text-sm break-all underline underline-offset-4"
          >
            {shownLink}
          </a>
        ) : canWrite ? (
          <form action={linkAction} className="mt-3">
            <input type="hidden" name="campaignId" value={campaignId} />
            <Button type="submit" size="sm" variant="outline" disabled={linkPending}>
              {linkPending ? "Preparando…" : "Preparar enlace"}
            </Button>
          </form>
        ) : (
          <p className="mt-2 text-sm">Todavía no hay enlace.</p>
        )}
      </section>
    </aside>
  );
}

function MessageList({
  messages,
  empty,
}: {
  messages: TalkMessage[];
  empty: string;
}) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ol className="grid gap-2">
      {messages.map((message) => (
        <li
          key={message.id}
          className={
            message.authorKind === "AGENCY"
              ? "ml-6 rounded-xl bg-primary px-3 py-2 text-primary-foreground"
              : message.authorKind === "ASSISTANT"
                ? "mr-4 rounded-xl bg-muted px-3 py-2"
                : "mr-6 rounded-xl border bg-background px-3 py-2"
          }
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] opacity-70">
            {message.authorKind === "ASSISTANT" ? "Mesa" : message.authorLabel}
          </p>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">
            {message.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
