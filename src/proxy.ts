import { NextResponse } from "next/server";

import { getAuth0Client } from "./lib/auth/auth0";
import { isAuth0Configured } from "./lib/auth/config";

export async function proxy(request: Request) {
  const url = new URL(request.url);

  if (!isAuth0Configured()) {
    if (
      url.pathname.startsWith("/auth/") &&
      !url.pathname.startsWith("/auth/local/")
    ) {
      const login = new URL("/iniciar-sesion", request.url);
      login.searchParams.set("motivo", "auth0");
      return NextResponse.redirect(login);
    }

    return NextResponse.next();
  }

  const auth0 = getAuth0Client();

  if (!auth0) {
    return NextResponse.next();
  }

  return auth0.middleware(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
