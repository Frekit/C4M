import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function QueryPager({
  page,
  pageSize,
  total,
  hrefForPage,
  noun,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefForPage: (page: number) => string;
  noun: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
      <p className="text-xs text-muted-foreground">
        {total === 0
          ? `Ningún ${noun}`
          : totalPages === 1
            ? `${total} ${noun}`
            : `Mostrando ${from}–${to} de ${total}`}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            disabled={page <= 1}
            render={page > 1 ? <Link href={hrefForPage(page - 1)} /> : undefined}
          >
            <ChevronLeftIcon />
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            disabled={page >= totalPages}
            render={
              page < totalPages ? <Link href={hrefForPage(page + 1)} /> : undefined
            }
          >
            Siguiente
            <ChevronRightIcon />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
