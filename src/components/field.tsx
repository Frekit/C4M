"use client";

import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ControlProps = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function fieldDescribedBy(
  id: string,
  options: { description?: boolean; error?: boolean }
) {
  const descriptionId = options.description ? `${id}-description` : undefined;
  const errorId = options.error ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return { descriptionId, errorId, describedBy };
}

export function Field({
  id,
  label,
  description,
  error,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  error?: string;
  className?: string;
  children: ReactElement;
}) {
  const { descriptionId, errorId, describedBy } = fieldDescribedBy(id, {
    description: Boolean(description),
    error: Boolean(error),
  });
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<ControlProps>, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {control}
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
