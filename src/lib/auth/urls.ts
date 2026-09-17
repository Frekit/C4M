import { isAuth0Configured, safeReturnTo } from "./config";

export function getLoginHref(returnTo?: string | null) {
  const destination = safeReturnTo(returnTo);

  if (isAuth0Configured()) {
    return `/auth/login?returnTo=${encodeURIComponent(destination)}`;
  }

  return `/iniciar-sesion?returnTo=${encodeURIComponent(destination)}`;
}

export function getLogoutHref() {
  if (isAuth0Configured()) {
    return "/auth/logout";
  }

  return "/auth/local/logout";
}

export function getSignupHref(returnTo?: string | null) {
  const destination = safeReturnTo(returnTo);

  if (isAuth0Configured()) {
    return `/auth/login?screen_hint=signup&returnTo=${encodeURIComponent(destination)}`;
  }

  return `/iniciar-sesion?returnTo=${encodeURIComponent(destination)}`;
}
