"use client";

import { useEffect } from "react";

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
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-heading text-2xl font-medium">Algo ha fallado</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || "No se ha podido cargar esta pantalla."}
      </p>
      <div>
        <Button onClick={reset}>Reintentar</Button>
      </div>
    </main>
  );
}
