import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { UsersIcon } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { getBaseUrl } from "@/lib/base-url";
import { prisma } from "@/lib/db";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@/lib/domain/enums";
import { formatDateTime } from "@/lib/format";

import { changeMemberRole, revokeInvitation, setMemberStatus } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = {
  title: "Equipo",
};

export default async function TeamPage() {
  const admin = await requirePermission("team:manage", "/equipo");
  const baseUrl = await getBaseUrl();

  const [members, invitations] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }] }),
    prisma.invitation.findMany({
      where: { acceptedAt: null, revokedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <PageShell width="default">
      <div className="space-y-1">
        <h1 className="text-heading-24">Equipo</h1>
        <p className="text-sm text-muted-foreground">
          El acceso es solo por invitación. Cada rol ve y puede hacer cosas
          distintas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invitar a alguien</CardTitle>
          <CardDescription>
            Se genera un enlace de un solo uso, válido 14 días.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm baseUrl={baseUrl} />
        </CardContent>
      </Card>

      {invitations.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Invitaciones pendientes</CardTitle>
            <CardDescription>
              Comparte el enlace con la persona: al abrirlo queda dentro.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[invitation.role as Role]} · caduca el{" "}
                    {formatDateTime(invitation.expiresAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CopyButton
                    value={`${baseUrl}/invitacion/${invitation.token}`}
                  />
                  <form action={revokeInvitation}>
                    <input
                      type="hidden"
                      name="invitationId"
                      value={invitation.id}
                    />
                    <Button type="submit" variant="ghost" size="sm">
                      Revocar
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <UsersIcon className="size-4 text-muted-foreground" />
          <CardTitle>Con acceso ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Persona</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="hidden sm:table-cell">Última entrada</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {member.name ?? member.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <form action={changeMemberRole} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={member.id} />
                      <select
                        name="role"
                        defaultValue={member.role}
                        className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                        aria-label={`Rol de ${member.email}`}
                      >
                        {Object.values(ROLES).map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="xs" variant="outline">
                        Guardar
                      </Button>
                    </form>
                    {member.status !== "ACTIVE" ? (
                      <Badge variant="destructive" className="mt-1">
                        Desactivado
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                    {formatDateTime(member.lastLoginAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {member.id === admin.id ? (
                      <span className="text-xs text-muted-foreground">Eres tú</span>
                    ) : (
                      <form action={setMemberStatus} className="inline">
                        <input type="hidden" name="userId" value={member.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={member.status === "ACTIVE" ? "DISABLED" : "ACTIVE"}
                        />
                        <Button type="submit" size="xs" variant="ghost">
                          {member.status === "ACTIVE" ? "Desactivar" : "Reactivar"}
                        </Button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Qué puede cada rol</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {Object.values(ROLES).map((role) => (
            <div key={role} className="rounded-lg border p-3">
              <p className="text-sm font-medium">{ROLE_LABELS[role]}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
