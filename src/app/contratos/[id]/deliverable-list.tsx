"use client";

import { useActionState } from "react";
import { CheckIcon, ExternalLinkIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";

import {
  markDeliverablePublished,
  unmarkDeliverable,
  type ContractActionResult,
} from "../actions";

export type DeliverableItem = {
  id: string;
  position: number;
  status: string;
  publishedAt: string | null;
  paymentDueAt: string | null;
  postUrl: string | null;
};

function PublishRow({ item }: { item: DeliverableItem }) {
  const [state, formAction, pending] = useActionState<
    ContractActionResult | null,
    FormData
  >(markDeliverablePublished, null);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
      <input type="hidden" name="deliverableId" value={item.id} />

      <div className="grid gap-1.5">
        <Label htmlFor={`publishedAt-${item.id}`} className="text-xs">
          Fecha de publicación
        </Label>
        <Input
          id={`publishedAt-${item.id}`}
          name="publishedAt"
          type="date"
          defaultValue={today}
          max={today}
          className="w-40"
          required
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`postUrl-${item.id}`} className="text-xs">
          Enlace del post (opcional)
        </Label>
        <Input
          id={`postUrl-${item.id}`}
          name="postUrl"
          type="url"
          placeholder="https://www.instagram.com/p/…"
          aria-invalid={Boolean(state?.fieldErrors?.postUrl)}
        />
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        <CheckIcon />
        {pending ? "Guardando…" : "Marcar publicado"}
      </Button>

      {state?.error ? (
        <p className="text-xs text-destructive sm:col-span-3">{state.error}</p>
      ) : null}
      {state?.fieldErrors?.postUrl ? (
        <p className="text-xs text-destructive sm:col-span-3">
          {state.fieldErrors.postUrl}
        </p>
      ) : null}
    </form>
  );
}

export function DeliverableList({
  deliverables,
  canPublish,
}: {
  deliverables: DeliverableItem[];
  canPublish: boolean;
}) {
  return (
    <ol className="grid gap-2">
      {deliverables.map((item) => {
        const published = item.status === "PUBLISHED";

        return (
          <li
            key={item.id}
            className="rounded-lg border p-3 data-published:bg-muted/30"
            data-published={published ? "" : undefined}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  Contenido {item.position}
                </span>
                {published ? (
                  <Badge variant="secondary">Publicado</Badge>
                ) : (
                  <Badge variant="outline">Pendiente</Badge>
                )}
              </div>

              {published ? (
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Publicado {formatDate(item.publishedAt)}</span>
                  <span>Pago previsto {formatDate(item.paymentDueAt)}</span>
                  {item.postUrl ? (
                    <a
                      href={item.postUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                    >
                      Ver post
                      <ExternalLinkIcon className="size-3" />
                    </a>
                  ) : null}
                  {canPublish ? (
                    <form action={unmarkDeliverable}>
                      <input type="hidden" name="deliverableId" value={item.id} />
                      <Button type="submit" variant="ghost" size="xs">
                        Deshacer
                      </Button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </div>

            {!published && canPublish ? (
              <div className="mt-3">
                <PublishRow item={item} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
