import { NextResponse } from "next/server";

import { isAuth0Active } from "@/lib/auth/config";
import { LOCAL_SESSION_COOKIE } from "@/lib/auth/local-session";

export async function GET(request: Request) {
  if (isAuth0Active()) {
    return NextResponse.redirect(new URL("/auth/logout", request.url));
  }

  const response = NextResponse.redirect(
    new URL("/iniciar-sesion", request.url)
  );
  response.cookies.delete(LOCAL_SESSION_COOKIE);
  return response;
}
