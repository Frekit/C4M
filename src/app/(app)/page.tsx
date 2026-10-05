import Link from "next/link";

import { ActionCenterBoard } from "@/components/action-center";
import { PageShell } from "@/components/page-shell";
import { SetCrumbs } from "@/components/shell-context";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import { loadActionCenter } from "@/lib/domain/action-center";

export default async function DashboardPage() {
  const user = await requireUser("/");
  const firstName = user.name.split(" ")[0] || user.name;
  const data = await loadActionCenter(firstName);

  return (
    <PageShell width="wide" className="gap-6">
      <SetCrumbs crumbs={[{ label: "Centro de acciones" }]} />
      {data.empty === "first-use" ? (
        <div className="mx-auto flex max-w-[520px] flex-1 flex-col justify-center gap-3 py-16 text-center">
          <h1 className="font-serif text-[22px] leading-7">Empieza por una campaña</h1>
          <p className="text-copy-14 text-muted-foreground">
            En C4M todo cuelga de una campaña: perfiles, contratos, contenidos y pagos.
          </p>
          {can(user.role, "campaigns:manage") ? (
            <Button data-primary="true" nativeButton={false} render={<Link href="/campanas" />}>
              Crear tu primera campaña
            </Button>
          ) : (
            <p className="text-copy-13 text-muted-foreground">
              Tu rol no puede crear campañas. Pídeselo a un admin.
            </p>
          )}
        </div>
      ) : (
        <ActionCenterBoard data={data} />
      )}
    </PageShell>
  );
}
