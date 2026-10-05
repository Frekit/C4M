"use client";

import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { SparklesIcon, XIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import { ApprovalCard, type ApprovalItem, type ApprovalUiState } from "@/components/approval-card";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { contextFromPathname, routeChip } from "@/lib/agent/route-context";
import {
  isReadTool,
  isWriteTool,
  readToolLabel,
  toolNameFromPart,
  writeToolDetail,
  writeToolTitle,
} from "@/lib/agent/tool-names";

type ToolPart = {
  type: string;
  state?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approval?: {
    id: string;
    approved?: boolean;
    reason?: string;
    requestReason?: string;
    isAutomatic?: boolean;
  };
};

function isToolPart(part: UIMessage["parts"][number]): part is UIMessage["parts"][number] & ToolPart {
  return part.type.startsWith("tool-");
}

function rowState(part: ToolPart, status: string): ApprovalUiState {
  const output = part.output as { ok?: boolean; error?: string } | undefined;
  if (part.state === "output-error") return "error";
  if (part.state === "output-available" && output && output.ok === false) return "error";
  if (part.state === "output-denied") {
    return part.approval?.isAutomatic ? "error" : "descartado";
  }
  if (part.state === "output-available") return "hecho";
  if (part.state === "approval-responded") {
    if (part.approval?.approved === false) return "descartado";
    if (status === "submitted" || status === "streaming") return "aplicando";
    return "aceptado";
  }
  if (part.approval?.requestReason) return "aviso";
  return "pendiente";
}

function rowWarning(part: ToolPart, state: ApprovalUiState) {
  if (state === "error") {
    const output = part.output as { error?: string } | undefined;
    return output?.error || part.approval?.reason || part.errorText || part.approval?.requestReason;
  }
  return part.approval?.requestReason;
}

function chipsFor(pathname: string) {
  if (pathname.startsWith("/campanas/")) {
    return ["Resume la planilla", "¿Quién va con retraso?", "¿Qué falta por aprobar?"];
  }
  if (pathname.startsWith("/contratos/")) {
    return ["Resume este contrato", "¿Se puede enviar a firma?", "¿Qué contenidos faltan?"];
  }
  return ["¿Qué necesita mi decisión?", "Resume lo pendiente", "¿Qué pagos hay listos?"];
}

export function LiveAiPanel({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const [draft, setDraft] = useState("");
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/agent",
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            messages,
            context: contextFromPathname(window.location.pathname),
          },
        }),
      })
  );
  const { messages, sendMessage, status, error, addToolApprovalResponse, regenerate } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  const busy = status === "submitted" || status === "streaming";
  const pendingApprovals = useMemo(() => {
    const last = messages.at(-1);
    if (!last || last.role !== "assistant") return [];
    return last.parts.filter(isToolPart).flatMap((part) => {
      const name = toolNameFromPart(part.type);
      if (!isWriteTool(name) || !part.approval?.id) return [];
      const state = rowState(part, status);
      if (state !== "pendiente" && state !== "aviso") return [];
      return [{ id: part.approval.id }];
    });
  }, [messages, status]);

  useHotkeys({
    y: () => {
      const item = pendingApprovals[0];
      if (!item || busy) return;
      void addToolApprovalResponse({ id: item.id, approved: true });
    },
    n: () => {
      const item = pendingApprovals[0];
      if (!item || busy) return;
      void addToolApprovalResponse({ id: item.id, approved: false });
    },
  });

  function submit(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    setDraft("");
    void sendMessage({ text: value });
  }

  return (
    <section aria-label="Asistente" className="flex h-full min-h-0 flex-col bg-card">
      <header className="flex h-[52px] shrink-0 items-center gap-2 border-b px-3">
        <SparklesIcon className="size-4 text-ai" />
        <p className="text-label-13">Asistente</p>
        <span className="inline-flex max-w-[46%] items-center truncate rounded-full border border-border bg-card px-2 py-0.5 text-label-12 text-muted-foreground">
          {routeChip(pathname)}
        </span>
        <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={onClose} aria-label="Cerrar asistente">
          <XIcon />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <p className="text-copy-14 text-muted-foreground">
            Pregúntame por esta pantalla o pídeme cambios. Te enseñaré cada cambio antes de hacerlo.
          </p>
        ) : null}
        {messages.map((message) => (
          <MessageView
            key={message.id}
            message={message}
            status={status}
            onAccept={(id) => void addToolApprovalResponse({ id, approved: true })}
            onDiscard={(id) => void addToolApprovalResponse({ id, approved: false })}
            onAcceptRest={(ids) => {
              for (const id of ids) void addToolApprovalResponse({ id, approved: true });
            }}
          />
        ))}
        {busy && messages.at(-1)?.role !== "assistant" ? (
          <p className="text-copy-13 text-ai">Pensando…</p>
        ) : null}
        {status === "error" ? (
          <div className="rounded-lg border border-danger/35 bg-danger-muted px-3 py-2 text-copy-13 text-danger">
            <p>No he podido responder. Inténtalo de nuevo.</p>
            {error?.message ? <p className="mt-1 text-copy-12">{error.message}</p> : null}
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void regenerate()}>
              Reintentar
            </Button>
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2">
          {chipsFor(pathname).map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={busy}
              className="h-7 rounded-full border border-border bg-card px-2.5 text-label-12 text-muted-foreground hover:border-ai/40 hover:bg-ai-muted hover:text-ai disabled:opacity-45"
              onClick={() => submit(chip)}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
      <form
        className="border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
      >
        <label className="sr-only" htmlFor="ai-composer">
          Mensaje para el asistente
        </label>
        <textarea
          id="ai-composer"
          rows={2}
          value={draft}
          disabled={busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit(draft);
            }
          }}
          placeholder={pathname.startsWith("/campanas/") ? "Pide algo sobre esta campaña…" : "Pide algo…"}
          className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-copy-14 outline-none focus-visible:border-ring disabled:opacity-60"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-copy-12 text-fg-subtle">El asistente propone; tú decides.</p>
          <Button type="submit" size="sm" disabled={busy || draft.trim().length === 0}>
            Enviar
          </Button>
        </div>
      </form>
    </section>
  );
}

function MessageView({
  message,
  status,
  onAccept,
  onDiscard,
  onAcceptRest,
}: {
  message: UIMessage;
  status: string;
  onAccept: (id: string) => void;
  onDiscard: (id: string) => void;
  onAcceptRest: (ids: string[]) => void;
}) {
  if (message.role === "user") {
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    return (
      <p className="ml-auto max-w-[86%] rounded-2xl rounded-br-sm bg-accent px-3 py-2 text-copy-14">
        {text}
      </p>
    );
  }

  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  const tools = message.parts.filter(isToolPart);
  const writes = tools.filter((part) => isWriteTool(toolNameFromPart(part.type)));
  const reads = tools.filter((part) => isReadTool(toolNameFromPart(part.type)));
  const items: ApprovalItem[] = writes
    .filter((part) => part.state !== "input-streaming")
    .map((part) => {
      const name = toolNameFromPart(part.type);
      const state = rowState(part, status);
      return {
        id: part.approval?.id ?? part.toolCallId ?? name,
        title: writeToolTitle(name, part.input),
        detail: writeToolDetail(name, part.input) || "Cambio propuesto",
        state,
        warning: rowWarning(part, state),
      };
    });
  const openIds = items
    .filter((item) => item.state === "pendiente" || item.state === "aviso")
    .map((item) => item.id);

  return (
    <div className="grid gap-2">
      {reads.map((part) => {
        const name = toolNameFromPart(part.type);
        const pending = part.state !== "output-available" && part.state !== "output-error";
        return (
          <p key={part.toolCallId ?? name} className="rounded-lg border border-border bg-muted px-2 py-1.5 text-copy-12 text-success">
            {pending ? "◌" : "✓"} {readToolLabel(name, part.output, pending)}
          </p>
        );
      })}
      {text ? <p className="text-copy-14 whitespace-pre-wrap">{text}</p> : null}
      {items.length > 0 ? (
        <ApprovalCard
          title={`${items.length} ${items.length === 1 ? "cambio" : "cambios"}`}
          items={items}
          onAccept={onAccept}
          onDiscard={onDiscard}
          onAcceptRest={openIds.length > 0 ? () => onAcceptRest(openIds) : undefined}
        />
      ) : null}
    </div>
  );
}
