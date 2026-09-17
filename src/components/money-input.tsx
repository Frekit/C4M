"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function MoneyInput({
  name,
  label,
  currency,
  value,
  onValueChange,
  error,
  description,
  required,
}: {
  name: string;
  label: string;
  currency: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  description?: string;
  required?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          inputMode="decimal"
          autoComplete="off"
          className="pr-14"
          placeholder="0,00"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={Boolean(error)}
          required={required}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs font-medium text-muted-foreground">
          {currency}
        </span>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
