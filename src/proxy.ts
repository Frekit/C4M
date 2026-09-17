import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getAuth0Client } from "./lib/auth/auth0";
import { isAuth0Configured } from "./lib/auth/config";
import {
  LOCAL_SESSION_COOKIE,
  parseLocalUser,
} from "./lib/auth/local-session";

const PROTECTED_PREFIXES = ["/cuenta"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAuth0Configured()) {
    const auth0 = getAuth0Client();

    if (!auth0) {
      return NextResponse.next();
    }

    const response = await auth0.middleware(request);

    if (isProtectedPath(pathname)) {
      const session = await auth0.getSession(request);

      if (!session) {
        const login = request.nextUrl.clone();
        login.pathname = "/auth/login";
        login.search = `?returnTo=${encodeURIComponent(pathname)}`;
        return NextResponse.redirect(login);
      }
    }

    return response;
  }

  if (pathname.startsWith("/auth/") && !pathname.startsWith("/auth/local/")) {
    const login = request.nextUrl.clone();
    login.pathname = "/iniciar-sesion";
    login.search = "?motivo=auth0";
    return NextResponse.redirect(login);
  }

  if (isProtectedPath(pathname) && !parseLocalUser(request.cookies.get(LOCAL_SESSION_COOKIE)?.value)) {
    const login = request.nextUrl.clone();
    login.pathname = "/iniciar-sesion";
    login.search = `?returnTo=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
