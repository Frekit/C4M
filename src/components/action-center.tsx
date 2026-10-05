"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { moveDeliverableDates } from "@/app/(app)/centro-actions";
import { useShell } from "@/components/shell-context";
import { Button } from "@/components/ui/button";
import type { ActionCard, ActionCenter, ActionKind } from "@/lib/domain/action-center";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { cn } from "@/lib/utils";

const RESOLVED_KEY = "c4m-resolved-actions";

function handleInitials(handle: string) {
  return handle.replace(/^@/, "").slice(0, 2).toUpperCase();
}

const FILTERS: { id: "todo" | ActionKind; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "firma", label: "Firmas" },
  { id: "contenido", label: "Contenidos" },
  { id: "pago", label: "Pagos" },
  { id: "mensaje", label: "Mensajes" },
];

function readResolved() {
  try {
    const raw = window.localStorage.getItem(RESOLVED_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

function writeResolved(ids: Set<string>) {
  window.localStorage.setItem(RESOLVED_KEY, JSON.stringify([...ids]));
}

export function ActionCenterBoard({ data }: { data: ActionCenter }) {
  const router = useRouter();
  const shell = useShell();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("todo");
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setResolved(readResolved()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visible = useMemo(
    () =>
      data.cards.filter(
        (card) => !resolved.has(card.id) && (filter === "todo" || card.kind === filter)
      ),
    [data.cards, filter, resolved]
  );
  const focused = visible[Math.min(focus, Math.max(visible.length - 1, 0))];

  function resolve(card: ActionCard) {
    const next = new Set(resolved);
    next.add(card.id);
    setResolved(next);
    writeResolved(next);
    toast("Tarjeta resuelta", {
      description: card.title,
      action: {
        label: "Deshacer",
        onClick: () => {
          const undone = readResolved();
          undone.delete(card.id);
          writeResolved(undone);
          setResolved(new Set(undone));
        },
      },
    });
  }

  async function runOption(card: ActionCard, key: "A" | "B" | "C") {
    const option = card.options?.find((item) => item.key === key);
    if (!option) return;
    if (option.kind === "assistant") {
      shell.askAssistant(card.campaignName ? `Sobre ${card.campaignName}: ${card.body}` : card.body);
      return;
    }
    if (option.kind === "move-date") {
      setConfirmId(card.id);
      return;
    }
    if (option.href) router.push(option.href);
  }

  useHotkeys({
    j: (event) => {
      event.preventDefault();
      setFocus((value) => Math.min(value + 1, Math.max(visible.length - 1, 0)));
    },
    k: (event) => {
      event.preventDefault();
      setFocus((value) => Math.max(value - 1, 0));
    },
    e: (event) => {
      if (!focused) return;
      event.preventDefault();
      resolve(focused);
    },
    a: (event) => {
      if (!focused?.options) return;
      event.preventDefault();
      void runOption(focused, "A");
    },
    b: (event) => {
      if (!focused?.options) return;
      event.preventDefault();
      void runOption(focused, "B");
    },
    c: (event) => {
      if (!focused?.options) return;
      event.preventDefault();
      void runOption(focused, "C");
    },
    Enter: (event) => {
      if (!focused) return;
      event.preventDefault();
      if (focused.options) void runOption(focused, "A");
      else if (focused.href) router.push(focused.href);
    },
  });

  const counts = {
    todo: data.cards.filter((card) => !resolved.has(card.id)).length,
    firma: data.cards.filter((card) => !resolved.has(card.id) && card.kind === "firma").length,
    contenido: data.cards.filter((card) => !resolved.has(card.id) && card.kind === "contenido").length,
    pago: data.cards.filter((card) => !resolved.has(card.id) && card.kind === "pago").length,
    mensaje: data.cards.filter((card) => !resolved.has(card.id) && card.kind === "mensaje").length,
  };

  return (
    <div className="grid items-start gap-7 min-[1024px]:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-eyebrow-11 text-fg-subtle">{data.eyebrow}</p>
            <h1 className="text-display-30">
              {data.greeting}, {data.firstName}.
            </h1>
            <p className="text-copy-14 text-muted-foreground">
              {visible.length === 0
                ? "No hay nada que necesite tu decisión."
                : `Hay ${counts.todo} ${counts.todo === 1 ? "cosa que espera" : "cosas que esperan"} una decisión tuya.`}
            </p>
          </div>
          <div role="group" aria-label="Filtrar decisiones" className="flex flex-wrap gap-1">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => {
                  setFilter(item.id);
                  setFocus(0);
                }}
                className={cn(
                  "h-8 rounded-full px-3 text-label-13",
                  filter === item.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                )}
              >
                {item.label} {counts[item.id]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid overflow-hidden rounded-xl border border-border sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Contratos en firma" value={String(data.kpis.signing)} hint={data.kpis.signingHint} />
          <Kpi label="Contenidos esta semana" value={String(data.kpis.thisWeek)} hint={data.kpis.thisWeekHint} />
          <Kpi label="Fecha pasada" value={String(data.kpis.late)} hint={data.kpis.late > 0 ? "Te toca a ti" : "Al día"} danger={data.kpis.late > 0} />
          <Kpi label="Listo para pagar" value={data.kpis.payoutLabel} hint="Vencido y sin pagar" />
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-heading-16">Necesita tu decisión</h2>
          <p className="hidden text-copy-12 text-fg-subtle sm:block">J/K moverte · E resolver</p>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-input px-6 py-8 text-center">
            <h3 className="font-serif text-[22px] leading-7">Todo al día</h3>
            <p className="mt-1 text-copy-13 text-muted-foreground">
              No hay nada que necesite tu decisión. Te avisaremos aquí cuando algo se pare.
            </p>
            <Button className="mt-4" variant="outline" nativeButton={false} render={<Link href="/campanas" />}>
              Ver campañas
            </Button>
          </div>
        ) : (
          <ul className="grid gap-3">
            {visible.map((card, index) => (
              <li key={card.id}>
                <article
                  tabIndex={0}
                  className={cn(
                    "rounded-xl border bg-card p-4 shadow-(--e1)",
                    index === focus && "ring-2 ring-ring",
                    card.options && "border-warning-dot/45 shadow-(--e2)"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-heading-14">
                        {card.href ? (
                          <Link href={card.href} className="hover:underline">
                            {card.title}
                          </Link>
                        ) : (
                          card.title
                        )}
                      </h3>
                      <p className="mt-1 text-copy-13 text-muted-foreground">{card.body}</p>
                      {card.meta ? <p className="text-copy-12 text-fg-subtle">{card.meta}</p> : null}
                      {card.handles.length > 0 ? (
                        <p className="mt-2 flex flex-wrap gap-1.5 text-copy-12 text-fg-subtle">
                          {card.handles.slice(0, 4).map((handle) => (
                            <span key={handle} className="inline-flex items-center gap-1">
                              <span className="grid size-6 place-items-center rounded-full bg-muted text-[10px]">
                                {handleInitials(handle)}
                              </span>
                              @{handle}
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </div>
                    {!card.options && card.primary ? (
                      <div className="flex flex-wrap gap-2 max-[760px]:w-full">
                        {card.secondary ? (
                          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={card.secondary.href} />}>
                            {card.secondary.label}
                          </Button>
                        ) : null}
                        <Button size="sm" nativeButton={false} render={<Link href={card.primary.href} />}>
                          {card.primary.label}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {card.options ? (
                    <div className="mt-3 grid gap-1.5">
                      {card.options.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => void runOption(card, option.key)}
                          className="flex items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted"
                        >
                          <kbd className="grid size-[22px] place-items-center rounded-[4px] border border-border font-mono text-[11px]">
                            {option.key}
                          </kbd>
                          <span className="text-copy-13">{option.label}</span>
                        </button>
                      ))}
                      {confirmId === card.id ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md bg-warning-muted px-3 py-2 text-copy-13 text-warning">
                          ¿Mover {card.options[0]?.deliverableIds?.length ?? 0} fechas al {card.options[0]?.dateLabel}?
                          <Button
                            size="sm"
                            disabled={pending}
                            onClick={() => {
                              const option = card.options?.find((item) => item.kind === "move-date");
                              if (!option?.deliverableIds || !option.dateValue) return;
                              setPending(true);
                              void moveDeliverableDates(option.deliverableIds, option.dateValue).then((result) => {
                                setPending(false);
                                setConfirmId(null);
                                if (!result.ok) {
                                  toast.error("No se ha guardado", { description: result.error });
                                  return;
                                }
                                toast(`Fecha movida al ${option.dateLabel}`, {
                                  description: `${result.count} contenidos`,
                                });
                                resolve(card);
                                router.refresh();
                              });
                            }}
                          >
                            {pending ? "Moviendo…" : "Mover"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        )}
        <p className="text-copy-12 text-fg-subtle">
          Resueltas en este navegador: {resolved.size}
        </p>
      </div>
      <aside className="grid gap-4">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-heading-14">Esta semana</h2>
          {data.week.length === 0 ? (
            <p className="mt-2 text-copy-13 text-muted-foreground">Nada programado en los próximos 7 días.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {data.week.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-copy-13">
                    <span className="text-fg-subtle uppercase">{item.day}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-heading-14">Actividad</h2>
          {data.activity.length === 0 ? (
            <p className="mt-2 text-copy-13 text-muted-foreground">Todavía no hay movimientos.</p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {data.activity.map((item) => (
                <li key={item.id} className="text-copy-13">
                  {item.label}
                </li>
              ))}
            </ul>
          )}
          <Link href="/auditoria" className="mt-3 inline-block text-label-13 text-brand">
            Ver historial
          </Link>
        </section>
      </aside>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <div className="border-border px-4 py-3.5 not-last:border-b sm:not-last:border-r sm:nth-[2n]:border-r-0 xl:nth-[2n]:border-r xl:not-last:border-b-0">
      <p className="text-copy-12 text-fg-subtle">{label}</p>
      <p className={cn("text-heading-20 tabular-nums", danger && "text-danger")}>{value}</p>
      <p className="text-copy-12 text-muted-foreground">{hint}</p>
    </div>
  );
}
