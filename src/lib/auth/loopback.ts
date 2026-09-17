/**
 * Auth0 solo tiene dado de alta el callback de localhost, no el de 127.0.0.1.
 * Si el navegador entra por el IP, la cookie de transacción y el redirect_uri
 * no coinciden y el SDK responde "An error occurred during the authorization flow."
 *
 * En Next, `request.nextUrl.hostname` a veces ya viene como localhost aunque el
 * Host sea 127.0.0.1: hay que mirar la cabecera.
 */
export function hostnameFromHostHeader(hostHeader: string | null | undefined): string | null {
  const host = hostHeader?.split(",")[0]?.trim();
  if (!host) return null;

  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end > 1 ? host.slice(1, end) : null;
  }

  return host.replace(/:\d+$/, "");
}

export function rewriteLoopbackUrl(
  url: URL,
  hostHeader?: string | null
): URL | null {
  const hostname = hostnameFromHostHeader(hostHeader) ?? url.hostname;
  const isLoopbackIp =
    hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";

  if (!isLoopbackIp) return null;

  const next = new URL(url);
  next.hostname = "localhost";
  return next;
}

export function auth0CallbackDetail(error: {
  name?: string;
  message?: string;
  cause?: unknown;
}): string {
  const cause = error.cause;
  if (cause && typeof cause === "object" && "message" in cause) {
    const message = (cause as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return "Auth0 no completó el login.";
}
