import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "success-muted"
  | "warning"
  | "destructive";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted text-foreground",
  info: "bg-info-muted text-info",
  success: "bg-success-muted text-success",
  "success-muted": "border border-success/35 bg-background text-success",
  warning: "bg-warning-muted text-warning",
  destructive: "bg-danger-muted text-danger",
};

const DOT_CLASS: Record<StatusTone, string> = {
  neutral: "bg-fg-subtle",
  info: "bg-info-dot",
  success: "bg-success-dot",
  "success-muted": "bg-success-dot",
  warning: "bg-warning-dot",
  destructive: "bg-danger-dot",
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] w-fit items-center gap-1.5 rounded-full px-2 text-label-12",
        TONE_CLASS[tone],
        className
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[tone])} />
      {children}
    </span>
  );
}
