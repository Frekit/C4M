import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { MailCheckIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/domain/enums";

import { AcceptForm } from "./accept-form";

export const metadata: Metadata = {
  title: "Invitación",
};

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await prisma.invitation.findUnique({ where: { token } });

  const isUsable =
    invitation &&
    !invitation.revokedAt &&
    !invitation.acceptedAt &&
    invitation.expiresAt >= new Date();

  return (
    <PageShell width="narrow" className="justify-center py-16">
      {isUsable ? (
        <Card>
          <CardHeader>
            <MailCheckIcon className="size-5 text-muted-foreground" />
            <CardTitle>Te han invitado al equipo</CardTitle>
            <CardDescription>
              Entrarás como <strong>{invitation.email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-lg border p-3">
              <Badge variant="outline">
                {ROLE_LABELS[invitation.role as Role]}
              </Badge>
              <p className="mt-2 text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[invitation.role as Role]}
              </p>
            </div>
            <AcceptForm token={token} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <TriangleAlertIcon className="size-5 text-muted-foreground" />
            <CardTitle>Esta invitación no sirve</CardTitle>
            <CardDescription>
              O ya se usó, o se revocó, o ha caducado. Pide una nueva a quien te
              invitó.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </PageShell>
  );
}
