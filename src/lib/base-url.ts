import { headers } from "next/headers";

// Los enlaces de firma e invitación se envían fuera de la app, así que
// necesitan URL absoluta.
export async function getBaseUrl(): Promise<string> {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  const proto = list.get("x-forwarded-proto") ?? "http";

  return host ? `${proto}://${host}` : "http://localhost:43127";
}
