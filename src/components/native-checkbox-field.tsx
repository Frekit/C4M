"use client";

// Casilla nativa: el formulario de firma lo rellena alguien de fuera, así que
// prima que funcione siempre y que el clic en el texto la marque de verdad.
export function NativeCheckboxField({
  name,
  title,
  description,
  checked,
  onCheckedChange,
  defaultChecked,
  error,
}: {
  name: string;
  title: string;
  description?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  defaultChecked?: boolean;
  error?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={name}
        className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40 has-checked:border-primary has-checked:bg-muted/30"
      >
        <input
          id={name}
          name={name}
          type="checkbox"
          value="on"
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={
            onCheckedChange
              ? (event) => onCheckedChange(event.target.checked)
              : undefined
          }
          aria-invalid={Boolean(error)}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span className="grid gap-1">
          <span className="text-sm font-medium">{title}</span>
          {description ? (
            <span className="text-xs text-muted-foreground">{description}</span>
          ) : null}
        </span>
      </label>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
