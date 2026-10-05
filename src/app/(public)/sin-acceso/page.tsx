import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { ShieldAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { getLogoutHref } from "@/lib/auth/urls";

export const metadata: Metadata = {
  title: "Sin acceso",
};

const REASONS: Record<string, { title: string; description: string }> = {
  not_invited: {
    title: "Tu cuenta no está invitada",
    description:
      "El acceso es solo por invitación. Pide a un administrador que te invite con este mismo correo y vuelve a entrar.",
  },
  disabled: {
    title: "Tu acceso está desactivado",
    description:
      "Un administrador ha desactivado esta cuenta. Si crees que es un error, habla con el equipo de finanzas.",
  },
};

export default async function NoAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const reason = REASONS[motivo ?? ""] ?? REASONS.not_invited;

  return (
    <PageShell width="narrow" className="justify-center py-16">
      <Card>
        <CardHeader>
          <ShieldAlertIcon className="size-5 text-muted-foreground" />
          <h1 className="font-heading text-base leading-snug font-medium">{reason.title}</h1>
          <CardDescription>{reason.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            nativeButton={false}
            render={<a href={getLogoutHref()} />}
          >
            Salir e intentar con otra cuenta
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
