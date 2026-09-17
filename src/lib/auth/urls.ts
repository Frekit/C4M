import { isAuth0Active, safeReturnTo } from "./config";

export function getLoginHref(returnTo?: string | null) {
  const destination = safeReturnTo(returnTo);

  if (isAuth0Active()) {
    return `/auth/login?returnTo=${encodeURIComponent(destination)}`;
  }

  return `/iniciar-sesion?returnTo=${encodeURIComponent(destination)}`;
}

export function getLogoutHref() {
  return isAuth0Active() ? "/auth/logout" : "/auth/local/logout";
}
