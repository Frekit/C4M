export function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "1", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export function queryHref(
  path: string,
  params: Record<string, string | undefined>,
  page = 1
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) continue;
    if (key === "pagina") continue;
    search.set(key, value);
  }
  if (page > 1) search.set("pagina", String(page));
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}
