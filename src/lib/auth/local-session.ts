import { cookies } from "next/headers";

import type { SessionIdentity } from "./types";

export const LOCAL_SESSION_COOKIE = "app_local_session";

export const localSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 7,
};

// La cookie local solo guarda con quién dice entrar; el rol y el acceso se
// resuelven siempre contra la base de datos.
export function parseLocalIdentity(
  raw: string | undefined
): SessionIdentity | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { email?: unknown; name?: unknown };

    if (typeof parsed.email !== "string" || !parsed.email.includes("@")) {
      return null;
    }

    return {
      sub: `local|${parsed.email.toLowerCase()}`,
      email: parsed.email.toLowerCase(),
      name: typeof parsed.name === "string" ? parsed.name : parsed.email,
      picture: null,
      provider: "local",
    };
  } catch {
    return null;
  }
}

export async function getLocalIdentity(): Promise<SessionIdentity | null> {
  const jar = await cookies();
  return parseLocalIdentity(jar.get(LOCAL_SESSION_COOKIE)?.value);
}
