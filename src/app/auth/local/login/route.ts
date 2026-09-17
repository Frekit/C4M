import { NextResponse } from "next/server";

import { isAuth0Configured, safeReturnTo } from "@/lib/auth/config";
import {
  LOCAL_SESSION_COOKIE,
  localSessionCookieOptions,
} from "@/lib/auth/local-session";
import type { AppUser } from "@/lib/auth/types";

function buildLocalUser(name: string, email: string): AppUser {
  const resolvedName = name.trim() || "Álvaro";
  const resolvedEmail = email.trim() || "alvaro@local.dev";

  return {
    sub: `local|${resolvedEmail.toLowerCase()}`,
    name: resolvedName,
    email: resolvedEmail,
    picture: null,
    nickname: resolvedName.split(" ")[0] ?? resolvedName,
    provider: "local",
  };
}

export async function POST(request: Request) {
  if (isAuth0Configured()) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const formData = await request.formData();
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));
  const user = buildLocalUser(
    String(formData.get("name") ?? ""),
    String(formData.get("email") ?? "")
  );

  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set(
    LOCAL_SESSION_COOKIE,
    JSON.stringify(user),
    localSessionCookieOptions
  );
  return response;
}
