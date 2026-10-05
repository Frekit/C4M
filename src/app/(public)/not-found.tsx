import Link from "next/link";
import { PageShell } from "@/components/page-shell";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageShell width="narrow" className="justify-center text-center py-16 gap-4">
      <h1 className="text-heading-24">Página no encontrada</h1>
      <p className="text-sm text-muted-foreground">
        Esa ruta no existe en esta base.
      </p>
      <div>
        <Button nativeButton={false} render={<Link href="/" />}>
          Volver al inicio
        </Button>
      </div>
    </PageShell>
  );
}
