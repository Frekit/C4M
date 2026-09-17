import { ChevronDownIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

// Desplegable nativo a propósito: es el que usa el talento desde su móvil, y un
// <select> real siempre envía su valor, sin depender de la hidratación ni del
// JavaScript del cliente.
export function NativeSelectField({
  name,
  label,
  options,
  defaultValue,
  description,
  error,
  required,
  disabled,
  className,
}: {
  name: string;
  label: string;
  options: SelectOption[];
  defaultValue?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        <select
          id={name}
          name={name}
          defaultValue={defaultValue ?? options[0]?.value}
          required={required}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute inset-y-0 right-2.5 my-auto size-4 text-muted-foreground" />
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
