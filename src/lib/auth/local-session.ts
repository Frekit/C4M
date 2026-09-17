import { cookies } from "next/headers";

import type { AppUser } from "./types";

export const LOCAL_SESSION_COOKIE = "app_local_session";

export const localSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 7,
};

export function parseLocalUser(raw: string | undefined): AppUser | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppUser>;

    if (
      typeof parsed.sub !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string"
    ) {
      return null;
    }

    return {
      sub: parsed.sub,
      name: parsed.name,
      email: parsed.email,
      picture: parsed.picture ?? null,
      nickname: parsed.nickname ?? null,
      provider: "local",
    };
  } catch {
    return null;
  }
}

export async function getLocalUser(): Promise<AppUser | null> {
  const jar = await cookies();
  return parseLocalUser(jar.get(LOCAL_SESSION_COOKIE)?.value);
}
