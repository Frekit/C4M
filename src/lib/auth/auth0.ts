import { Auth0Client } from "@auth0/nextjs-auth0/server";

import { isAuth0Configured } from "./config";

let auth0Client: Auth0Client | null = null;

export function getAuth0Client(): Auth0Client | null {
  if (!isAuth0Configured()) {
    return null;
  }

  if (!auth0Client) {
    auth0Client = new Auth0Client({
      authorizationParameters: {
        scope: "openid profile email",
      },
    });
  }

  return auth0Client;
}
