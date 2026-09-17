import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const PARTICULARS_HINT =
  "Van al PDF y prevalecen sobre las cláusulas generales. Contenido orgánico, DMs (Many Chat u otra herramienta) y paid media aparte ya están en el contrato: aquí solo lo específico de este talento.";

export function ParticularsNotesField({
  defaultValue,
  error,
  required = false,
  rows = 6,
  id = "notes",
}: {
  defaultValue?: string | null;
  error?: string;
  required?: boolean;
  rows?: number;
  id?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>
        Condiciones particulares{required ? "" : " (opcional)"}
      </Label>
      <Textarea
        id={id}
        name="notes"
        rows={rows}
        required={required}
        defaultValue={defaultValue ?? ""}
        aria-invalid={Boolean(error)}
        placeholder="Exclusividad, formatos, calendario, usos extra, idioma de los DMs…"
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">{PARTICULARS_HINT}</p>
      )}
    </div>
  );
}
