const TOKEN_PATH = /^\/(firmar|hablar|invitacion)\/[^/]+/;

// Speed Insights recibe la URL real. En estas rutas el segmento siguiente
// es el token del enlace, y no debe salir del navegador.
export function redactPublicTokens(url: string): string {
  try {
    const parsed = new URL(url, "http://local.invalid");
    if (!TOKEN_PATH.test(parsed.pathname)) return url;
    parsed.pathname = parsed.pathname.replace(TOKEN_PATH, "/$1");
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return parsed.toString();
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}
