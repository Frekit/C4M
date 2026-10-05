import { PageShell } from "@/components/page-shell";

export default function AccountLoading() {
  return (
    <PageShell width="default" className="py-10">
      <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
      <div className="h-56 animate-pulse rounded-xl bg-muted" />
    </PageShell>
  );
}
