"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SelectOption = { value: string; label: string };

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  description,
  required,
  disabled,
}: {
  name: string;
  label: string;
  options: SelectOption[];
  defaultValue?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Select
        name={name}
        items={options}
        defaultValue={defaultValue ?? options[0]?.value}
        required={required}
        disabled={disabled}
      >
        <SelectTrigger id={name} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
