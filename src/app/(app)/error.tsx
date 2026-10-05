"use client";

import { useEffect } from "react";

import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell width="narrow" className="justify-center text-center py-16 gap-4">
      <h1 className="text-heading-24">Algo ha fallado</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || "No se ha podido cargar esta pantalla."}
      </p>
      <div>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </PageShell>
  );
}
