import { NextResponse } from "next/server";

import { isAuth0Active, safeReturnTo } from "@/lib/auth/config";
import {
  LOCAL_SESSION_COOKIE,
  localSessionCookieOptions,
} from "@/lib/auth/local-session";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  if (isAuth0Active()) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const formData = await request.formData();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

  // El acceso es solo por invitación: sin fila en User no se entra, ni en local.
  if (!user || user.status !== "ACTIVE") {
    const login = new URL("/iniciar-sesion", request.url);
    login.searchParams.set("error", "sin-invitacion");
    login.searchParams.set("email", email);
    if (returnTo !== "/") login.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(login, 303);
  }

  const response = NextResponse.redirect(new URL(returnTo, request.url), 303);
  response.cookies.set(
    LOCAL_SESSION_COOKIE,
    JSON.stringify({ email: user.email, name: user.name ?? user.email }),
    localSessionCookieOptions
  );
  return response;
}
