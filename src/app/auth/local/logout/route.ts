import { NextResponse } from "next/server";

import { isAuth0Configured } from "@/lib/auth/config";
import { LOCAL_SESSION_COOKIE } from "@/lib/auth/local-session";

export async function GET(request: Request) {
  if (isAuth0Configured()) {
    return NextResponse.redirect(new URL("/auth/logout", request.url));
  }

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(LOCAL_SESSION_COOKIE);
  return response;
}
