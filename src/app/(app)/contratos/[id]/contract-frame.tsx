"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { PageHeader, PageTab, PageTabs } from "@/components/page-shell";
import { useShellOptional } from "@/components/shell-context";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { cn } from "@/lib/utils";

const STEPS = ["Borrador", "Enviado", "Firmado", "Completado"] as const;

export function ContractFrame({
  code,
  title,
  meta,
  statusLabel,
  tone,
  step,
  tab,
  basePath,
  contentCount,
  prevHref,
  nextHref,
  positionLabel,
  checklist,
  hint,
  primary,
  secondary,
  children,
}: {
  code: string;
  title: string;
  meta: string;
  statusLabel: string;
  tone: StatusTone;
  step: number;
  tab: "resumen" | "contenidos" | "firma" | "historial";
  basePath: string;
  contentCount: number;
  prevHref: string | null;
  nextHref: string | null;
  positionLabel: string | null;
  checklist: { ok: boolean; label: string; href: string }[];
  hint: string;
  primary: React.ReactNode;
  secondary: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const shell = useShellOptional();
  const done = checklist.filter((item) => item.ok).length;

  useHotkeys({
    j: (event) => {
      if (!nextHref) return;
      event.preventDefault();
      router.push(nextHref);
    },
    k: (event) => {
      if (!prevHref) return;
      event.preventDefault();
      router.push(prevHref);
    },
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      const button = document.querySelector<HTMLElement>("[data-contract-primary]");
      if (!button || button.getAttribute("aria-disabled") === "true") return;
      event.preventDefault();
      button.click();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col gap-4">
      <div className="flex items-center justify-end gap-1">
        {positionLabel ? (
          <span className="mr-1 font-mono text-copy-12 text-fg-subtle">{positionLabel}</span>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Contrato anterior"
          disabled={!prevHref}
          nativeButton={false}
          render={prevHref ? <Link href={prevHref} /> : <span />}
        >
          <ChevronUpIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Contrato siguiente"
          disabled={!nextHref}
          nativeButton={false}
          render={nextHref ? <Link href={nextHref} /> : <span />}
        >
          <ChevronDownIcon />
        </Button>
      </div>

      <PageHeader
        eyebrow={<span className="font-mono text-fg">{code}</span>}
        title={title}
        status={<StatusPill tone={tone}>{statusLabel}</StatusPill>}
        meta={<span>{meta}</span>}
        secondary={
          <>
            {secondary}
            <Button
              variant="outline"
              onClick={() => shell?.askAssistant(`Revisa el contrato ${code}`)}
            >
              Revisar con IA
            </Button>
          </>
        }
        primary={null}
        tabs={
          <PageTabs>
            <PageTab href={`${basePath}?pestana=resumen`} active={tab === "resumen"}>
              Resumen
            </PageTab>
            <PageTab href={`${basePath}?pestana=contenidos`} active={tab === "contenidos"}>
              Contenidos {contentCount}
            </PageTab>
            <PageTab href={`${basePath}?pestana=firma`} active={tab === "firma"}>
              Firma y pago
            </PageTab>
            <PageTab href={`${basePath}?pestana=historial`} active={tab === "historial"}>
              Historial
            </PageTab>
          </PageTabs>
        }
      />

      <ol className="flex items-center gap-2 text-label-12 text-muted-foreground max-[760px]:hidden">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "grid size-5 place-items-center rounded-full border text-[11px]",
                index < step && "border-success bg-success-muted text-success",
                index === step && "border-primary bg-primary text-primary-foreground",
                index > step && "border-input"
              )}
            >
              {index + 1}
            </span>
            <span className={index === step ? "text-foreground" : undefined}>{label}</span>
            {index < STEPS.length - 1 ? <span className="mx-1 h-px w-8 bg-border" /> : null}
          </li>
        ))}
      </ol>
      <p className="text-label-13 min-[761px]:hidden">
        Paso {Math.max(step + 1, 1)} de 4
        {step >= 0 ? ` · ${STEPS[step] ?? ""}` : ""}
      </p>

      <div className="grid items-start gap-6 min-[1024px]:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 gap-4">{children}</div>
        {tab === "resumen" || tab === "firma" ? (
          <aside className="grid gap-3 min-[1024px]:sticky min-[1024px]:top-[76px]">
            <div className="rounded-xl border bg-card p-3">
              <p className="text-label-13">
                Antes de enviar{" "}
                <span className="text-fg-subtle">
                  {done} de {checklist.length}
                </span>
              </p>
              <ul className="mt-2 grid gap-1.5">
                {checklist.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="text-copy-13 hover:underline">
                      <span className={item.ok ? "text-success" : "text-warning"} aria-hidden>
                        {item.ok ? "✓" : "○"}
                      </span>{" "}
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        ) : (
          <span className="hidden" />
        )}
      </div>

      <footer className="sticky bottom-0 z-20 -mx-4 mt-auto border-t bg-background/95 px-4 py-3 backdrop-blur min-[1024px]:-mx-6 min-[1024px]:px-6 min-[1181px]:-mx-8 min-[1181px]:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-copy-12 text-muted-foreground">{hint}</p>
          <div className="flex flex-wrap gap-2 max-[760px]:w-full max-[760px]:[&_a]:flex-1 max-[760px]:[&_button]:flex-1">
            {primary}
          </div>
        </div>
      </footer>
    </div>
  );
}
