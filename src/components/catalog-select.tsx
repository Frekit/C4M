import type { RosterCatalogOption } from "@/lib/domain/roster-catalog";

export function CatalogSelect({
  id,
  name,
  options,
  defaultValue,
  allowEmpty = true,
  emptyLabel = "Sin asignar",
  required = false,
  className,
}: {
  id?: string;
  name: string;
  options: RosterCatalogOption[];
  defaultValue?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      required={required}
      defaultValue={defaultValue ?? ""}
      className={
        className ??
        "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30"
      }
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {options.map((option) => (
        <option key={option.id} value={option.slug}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
