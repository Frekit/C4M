import Link from "next/link";

import { Button } from "@/components/ui/button";

export function NotFoundMessage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-heading text-2xl font-medium">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">
        Esa ruta no existe en esta base.
      </p>
      <div>
        <Button nativeButton={false} render={<Link href="/" />}>
          Volver al inicio
        </Button>
      </div>
    </main>
  );
}
