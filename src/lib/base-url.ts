import { headers } from "next/headers";

// Los enlaces de firma e invitación se envían fuera de la app, así que
// necesitan URL absoluta.
export async function getBaseUrl(): Promise<string> {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  try {
    const list = await headers();
    const host = list.get("x-forwarded-host") ?? list.get("host");
    const proto = list.get("x-forwarded-proto") ?? "http";
    if (host) return `${proto}://${host}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("outside a request scope")) throw error;
  }

  return "http://localhost:43127";
}
