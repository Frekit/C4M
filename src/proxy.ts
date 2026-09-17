import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getAuth0Client } from "./lib/auth/auth0";
import { isAuth0Active } from "./lib/auth/config";
import {
  LOCAL_SESSION_COOKIE,
  parseLocalIdentity,
} from "./lib/auth/local-session";

// Rutas accesibles sin sesión. El enlace de firma es público a propósito: lo
// abre el talento o su agencia, que no tienen cuenta en la plataforma.
const PUBLIC_PREFIXES = ["/iniciar-sesion", "/sin-acceso", "/firmar", "/auth"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAuth0Active()) {
    const auth0 = getAuth0Client();

    if (!auth0) {
      return NextResponse.next();
    }

    const response = await auth0.middleware(request);

    if (!isPublicPath(pathname)) {
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

  // Modo local: las rutas de Auth0 no existen, se manda al login propio.
  if (pathname.startsWith("/auth/") && !pathname.startsWith("/auth/local/")) {
    const login = request.nextUrl.clone();
    login.pathname = "/iniciar-sesion";
    login.search = "?motivo=auth0";
    return NextResponse.redirect(login);
  }

  if (
    !isPublicPath(pathname) &&
    !parseLocalIdentity(request.cookies.get(LOCAL_SESSION_COOKIE)?.value)
  ) {
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
