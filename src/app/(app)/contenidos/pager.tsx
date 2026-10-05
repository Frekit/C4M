import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  contentsHref,
  type ContentFilters,
} from "@/lib/domain/contents-query";

export function ContentsPager({
  page,
  pageSize,
  total,
  filters,
}: {
  page: number;
  pageSize: number;
  total: number;
  filters: ContentFilters;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <p className="text-xs text-muted-foreground">
        {total === 0
          ? "Ningún contenido"
          : totalPages === 1
            ? `${total} ${total === 1 ? "contenido" : "contenidos"}`
            : `Mostrando ${from}–${to} de ${total}`}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={contentsHref(filters, page - 1)} />}
            >
              <ChevronLeftIcon />
              Anterior
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeftIcon />
              Anterior
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={contentsHref(filters, page + 1)} />}
            >
              Siguiente
              <ChevronRightIcon />
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Siguiente
              <ChevronRightIcon />
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
