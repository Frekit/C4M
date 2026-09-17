import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LocalLoginForm({ returnTo }: { returnTo: string }) {
  return (
    <form action="/auth/local/login" method="post" className="grid gap-4">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="grid gap-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          defaultValue="Álvaro Romero"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue="alvaro@local.dev"
          required
        />
      </div>
      <Button type="submit" className="w-full" size="lg">
        Crear sesión local
      </Button>
    </form>
  );
}
