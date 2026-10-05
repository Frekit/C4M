import type { Metadata } from "next";
import { MailCheckIcon, TriangleAlertIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6">
      {isUsable ? (
        <Card>
          <CardHeader>
            <MailCheckIcon className="size-5 text-muted-foreground" />
            <h1
              data-slot="card-title"
              className="font-heading text-base leading-snug font-medium"
            >
              Te han invitado al equipo
            </h1>
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
            <h1
              data-slot="card-title"
              className="font-heading text-base leading-snug font-medium"
            >
              Esta invitación no sirve
            </h1>
            <CardDescription>
              O ya se usó, o se revocó, o ha caducado. Pide una nueva a quien te
              invitó.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
