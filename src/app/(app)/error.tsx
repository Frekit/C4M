"use client";

import { useEffect } from "react";

import Link from "next/link";

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
      <h1 className="font-serif text-[22px] leading-7">Algo ha fallado al cargar esta página.</h1>
      <p className="text-sm text-muted-foreground">No has perdido nada.</p>
      <div className="flex justify-center gap-2">
        <Button onClick={reset}>Recargar</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
          Ir al Centro de acciones
        </Button>
      </div>
    </PageShell>
  );
}
