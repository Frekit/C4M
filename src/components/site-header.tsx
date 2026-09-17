import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { AppUser, AuthMode } from "@/lib/auth/types";
import { getLoginHref, getLogoutHref } from "@/lib/auth/urls";

export function SiteHeader({
  user,
  authMode,
}: {
  user: AppUser | null;
  authMode: AuthMode;
}) {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-heading text-sm font-medium tracking-tight">
          Foundations
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button variant="ghost" nativeButton={false} render={<Link href="/estado" />}>
            Estado
          </Button>
          {user ? (
            <>
              <Button variant="ghost" nativeButton={false} render={<Link href="/cuenta" />}>
                Cuenta
              </Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<a href={getLogoutHref()} />}
              >
                Salir
              </Button>
            </>
          ) : (
            <Button nativeButton={false} render={<Link href={getLoginHref()} />}>
              {authMode === "auth0" ? "Entrar con Auth0" : "Entrar"}
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
