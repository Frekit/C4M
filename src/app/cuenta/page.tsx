import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { requireUser } from "@/lib/auth/session";
import { getLogoutHref } from "@/lib/auth/urls";

export const metadata: Metadata = {
  title: "Cuenta",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function AccountPage() {
  const user = await requireUser("/cuenta");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-medium tracking-tight">
          Cuenta
        </h1>
        <p className="text-sm text-muted-foreground">
          Ruta protegida. Si no hay sesión, `requireUser()` redirige a iniciar
          sesión.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-start gap-4">
          <Avatar size="lg">
            {user.picture ? <AvatarImage src={user.picture} alt="" /> : null}
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <CardTitle>{user.name}</CardTitle>
            <CardDescription>{user.email || "Sin email"}</CardDescription>
            <Badge variant="outline">
              {user.provider === "auth0" ? "Auth0" : "Sesión local"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <Separator />
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">sub</span>
            <span className="truncate font-mono text-xs">{user.sub}</span>
          </div>
          {user.nickname ? (
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">nickname</span>
              <span>{user.nickname}</span>
            </div>
          ) : null}
          <Button
            variant="outline"
            className="mt-2"
            nativeButton={false}
            render={<a href={getLogoutHref()} />}
          >
            Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
