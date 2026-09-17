import { redirect } from "next/navigation";

import { getAuth0Client } from "./auth0";
import { isAuth0Configured } from "./config";
import { getLocalUser } from "./local-session";
import type { AppUser } from "./types";

export async function getCurrentUser(): Promise<AppUser | null> {
  if (isAuth0Configured()) {
    const auth0 = getAuth0Client();
    const session = auth0 ? await auth0.getSession() : null;
    const user = session?.user;

    if (!user?.sub) {
      return null;
    }

    return {
      sub: user.sub,
      name: user.name ?? user.nickname ?? user.email ?? "Cuenta Auth0",
      email: user.email ?? "",
      picture: user.picture ?? null,
      nickname: user.nickname ?? null,
      provider: "auth0",
    };
  }

  return getLocalUser();
}

export async function requireUser(returnTo = "/cuenta"): Promise<AppUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/iniciar-sesion?returnTo=${encodeURIComponent(returnTo)}`);
  }

  return user;
}
