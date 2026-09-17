import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LocalLoginForm({
  returnTo,
  defaultEmail,
}: {
  returnTo: string;
  defaultEmail?: string;
}) {
  return (
    <form action="/auth/local/login" method="post" className="grid gap-4">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="grid gap-2">
        <Label htmlFor="email">Email del equipo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@empresa.com"
          defaultValue={defaultEmail}
          required
        />
        <p className="text-xs text-muted-foreground">
          Solo entran las cuentas invitadas.
        </p>
      </div>
      <Button type="submit" className="w-full" size="lg">
        Entrar
      </Button>
    </form>
  );
}
