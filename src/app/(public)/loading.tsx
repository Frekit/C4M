import { PageShell } from "@/components/page-shell";

export default function Loading() {
  return (
    <PageShell width="default" className="py-10">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-muted" />
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
    </PageShell>
  );
}
