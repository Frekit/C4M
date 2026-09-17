import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { NextResponse } from "next/server";

import { isAuth0Active } from "./config";
import { auth0CallbackDetail } from "./loopback";

let auth0Client: Auth0Client | null = null;

function appBaseUrl() {
  return (process.env.APP_BASE_URL ?? "http://localhost:43127").replace(
    /\/$/,
    ""
  );
}

export function getAuth0Client(): Auth0Client | null {
  if (!isAuth0Active()) {
    return null;
  }

  if (!auth0Client) {
    auth0Client = new Auth0Client({
      authorizationParameters: {
        scope: "openid profile email",
      },
      appBaseUrl: appBaseUrl(),
      async onCallback(error, ctx) {
        if (error) {
          const cause =
            error.cause && typeof error.cause === "object"
              ? {
                  name: (error.cause as { name?: string }).name,
                  message: (error.cause as { message?: string }).message,
                  code: (error.cause as { code?: string }).code,
                }
              : error.cause;

          console.error("[auth0] callback failed", {
            name: error.name,
            message: error.message,
            cause,
          });

          const login = new URL("/iniciar-sesion", ctx.appBaseUrl ?? appBaseUrl());
          login.searchParams.set("error", "auth0");
          login.searchParams.set("detalle", auth0CallbackDetail(error).slice(0, 180));
          return NextResponse.redirect(login);
        }

        return NextResponse.redirect(
          new URL(ctx.returnTo || "/", ctx.appBaseUrl ?? appBaseUrl())
        );
      },
    });
  }

  return auth0Client;
}
