"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarX2Icon,
  ChevronRightIcon,
  CircleXIcon,
  FileClockIcon,
  Link2OffIcon,
  MessageSquareIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react";
import { toast } from "sonner";

import { moveDeliverableDates } from "@/app/(app)/centro-actions";
import { useShell } from "@/components/shell-context";
import { StatusPill } from "@/components/status-pill";
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
            <p className="text-eyebrow-11 mb-1.5 text-fg-subtle">{data.eyebrow}</p>
            <h1 className="max-w-[640px] text-display-30">
              {data.greeting}, {data.firstName}.{" "}
              <span className="text-muted-foreground">
                {visible.length === 0
                  ? "No hay nada que necesite tu decisión."
                  : `Hay ${counts.todo} ${counts.todo === 1 ? "cosa que espera" : "cosas que esperan"} una decisión tuya.`}
              </span>
            </h1>
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
          <Kpi
            label="Fecha pasada sin publicar"
            value={String(data.kpis.late)}
            hint={
              data.cards.find((card) => card.id.startsWith("late-"))?.campaignName ??
              (data.kpis.late > 0 ? "Te toca a ti" : "Al día")
            }
            danger={data.kpis.late > 0}
          />
          <Kpi label="Listo para pagar" value={data.kpis.payoutLabel} hint="Vencido y sin pagar" />
        </div>

        <div className="flex items-center gap-2.5">
          <h2 className="text-heading-16">Necesita tu decisión</h2>
          {visible.some((card) => card.options) ? <StatusPill tone="warning">Urgente</StatusPill> : null}
          <p className="ml-auto hidden text-copy-12 text-fg-subtle sm:block">J / K para moverte · E para resolver</p>
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
                    "overflow-hidden rounded-xl border bg-card shadow-(--e1)",
                    index === focus && "ring-2 ring-ring",
                    card.options && "border-warning-dot/45 shadow-(--e2)"
                  )}
                >
                  <div className="flex flex-wrap items-start gap-3 p-3.5">
                    <CardGlyph card={card} />
                    <div className="min-w-0 flex-1">
                      {card.meta ? <p className="text-copy-12 text-fg-subtle">{card.meta}</p> : null}
                      <h3 className="text-heading-14">
                        {card.href ? (
                          <Link href={card.href} className="hover:underline">
                            {card.title}
                          </Link>
                        ) : (
                          card.title
                        )}
                      </h3>
                      {card.body ? (
                        <p className="mt-0.5 text-copy-13 text-muted-foreground">{card.body}</p>
                      ) : null}
                      {card.handles.length > 0 ? (
                        <p className="mt-1.5 flex items-center gap-2 text-copy-13 text-muted-foreground">
                          <span className="flex">
                            {card.handles.slice(0, 3).map((handle, handleIndex) => (
                              <span
                                key={handle}
                                className={cn(
                                  "grid size-5 place-items-center rounded-full border-2 border-card bg-muted text-[8px] text-foreground",
                                  handleIndex > 0 && "-ml-1.5"
                                )}
                              >
                                {handleInitials(handle)}
                              </span>
                            ))}
                          </span>
                          {card.handles
                            .slice(0, 3)
                            .map((handle) => `@${handle}`)
                            .join(", ")}
                        </p>
                      ) : null}
                    </div>
                    {!card.options && card.primary ? (
                      <div className="flex flex-wrap gap-2 max-[760px]:w-full max-[760px]:pl-11">
                        {card.secondary ? (
                          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={card.secondary.href} />}>
                            {card.secondary.label}
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant={card.kind === "pago" || card.kind === "contenido" ? "outline" : "default"}
                          nativeButton={false}
                          render={<Link href={card.primary.href} />}
                        >
                          {card.primary.label}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {card.options ? (
                    <div className="grid gap-0.5 border-t border-border p-1.5">
                      {card.options.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => void runOption(card, option.key)}
                          className="flex items-center gap-3 rounded-md px-2.5 py-2 text-left hover:bg-muted"
                        >
                          <kbd
                            className={cn(
                              "grid size-[22px] shrink-0 place-items-center rounded-md border border-border bg-card font-mono text-[11px] text-muted-foreground",
                              option.kind === "assistant" && "border-transparent bg-ai-muted text-ai"
                            )}
                          >
                            {option.key}
                          </kbd>
                          <span className="min-w-0 flex-1">
                            <span className="block text-label-13">{option.label}</span>
                            {option.hint ? (
                              <span className="block text-copy-12 text-muted-foreground">{option.hint}</span>
                            ) : null}
                          </span>
                          {option.kind === "assistant" ? (
                            <SparklesIcon className="size-4 text-ai" aria-hidden />
                          ) : (
                            <ChevronRightIcon className="size-4 text-fg-subtle" aria-hidden />
                          )}
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
      <aside className="grid gap-4 min-[761px]:max-[1023px]:grid-cols-2">
        <section className="overflow-hidden rounded-xl border bg-card shadow-(--e1)">
          <div className="flex items-center px-4 pt-3.5">
            <h2 className="text-heading-14">Esta semana</h2>
            <Link href="/contenidos" className="ml-auto text-label-12 text-fg-subtle">
              Calendario
            </Link>
          </div>
          {data.week.length === 0 ? (
            <p className="px-4 py-3 text-copy-13 text-muted-foreground">Nada programado en los próximos 7 días.</p>
          ) : (
            <ul className="px-4 pb-2">
              {data.week.slice(0, 6).map((item) => {
                const match = item.day.match(/^(\p{L}+).*?(\d+)/u);
                const name = (match?.[1] ?? item.day).slice(0, 3).toUpperCase();
                const num = match?.[2] ?? "";
                return (
                  <li key={item.id} className="border-b border-border last:border-0">
                    <Link
                      href={item.href}
                      className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-2.5 py-2"
                    >
                      <span className="rounded-md border border-border py-0.5 text-center text-[11px] leading-[14px] text-fg-subtle">
                        {name}
                        <b className="block text-[15px] leading-[18px] font-semibold text-foreground">{num}</b>
                      </span>
                      <span className="truncate text-label-13">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="overflow-hidden rounded-xl border bg-card shadow-(--e1)">
          <h2 className="px-4 pt-3.5 text-heading-14">Actividad</h2>
          {data.activity.length === 0 ? (
            <p className="px-4 py-3 text-copy-13 text-muted-foreground">Todavía no hay movimientos.</p>
          ) : (
            <ul className="px-4 py-2">
              {data.activity.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5 py-1.5 text-copy-13 text-muted-foreground">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] text-foreground">
                    {handleInitials(item.label.split(/[\s@]/)[0] || "C4")}
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/auditoria" className="inline-block px-4 pb-3 text-label-13 text-brand">
            Ver historial
          </Link>
        </section>
      </aside>
    </div>
  );
}

function CardGlyph({ card }: { card: ActionCard }) {
  const Icon = card.id.startsWith("late-")
    ? CalendarX2Icon
    : card.kind === "firma"
      ? FileClockIcon
      : card.kind === "pago"
        ? WalletIcon
        : card.kind === "mensaje"
          ? MessageSquareIcon
          : card.id.startsWith("platform-")
            ? CircleXIcon
            : Link2OffIcon;
  const tone = card.id.startsWith("late-")
    ? "bg-warning-muted text-warning"
    : card.tone === "danger"
      ? "bg-danger-muted text-danger"
      : card.kind === "pago"
        ? "bg-success-muted text-success"
        : card.kind === "firma"
          ? "bg-brand-muted text-brand"
          : card.tone === "warning"
            ? "bg-warning-muted text-warning"
            : "bg-info-muted text-info";
  return (
    <div className={cn("grid size-8 shrink-0 place-items-center rounded-md", tone)}>
      <Icon className="size-4" aria-hidden />
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
