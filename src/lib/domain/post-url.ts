const TRACKING_PARAMS = new Set([
  "igsh",
  "igshid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "si",
  "feature",
]);

export type DuplicatePostUrlTarget = {
  position: number;
  contract: {
    code: string;
    creator: { handle: string };
  };
};

// Clave estable para no repetir el mismo post con www, barra final o utm.
export function postUrlKey(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  const parsed = parseHttpUrl(trimmed);
  if (!parsed) {
    return trimmed.toLowerCase();
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const instagram = instagramShortcode(host, parsed.pathname);
  if (instagram) return instagram;

  const tiktok = tiktokVideo(host, parsed.pathname);
  if (tiktok) return tiktok;

  const youtube = youtubeVideo(host, parsed.pathname, parsed.searchParams);
  if (youtube) return youtube;

  const path = parsed.pathname.replace(/\/+$/, "") || "";
  const kept = [...parsed.searchParams.entries()]
    .filter(([name]) => !isTrackingParam(name))
    .sort(([a], [b]) => a.localeCompare(b));
  const query = kept.length
    ? `?${new URLSearchParams(kept).toString()}`
    : "";
  return `${host}${path}${query}`;
}

export function duplicatePostUrlError(existing: DuplicatePostUrlTarget): string {
  return `Ese enlace ya está en @${existing.contract.creator.handle} · ${existing.contract.code} · contenido nº ${existing.position}.`;
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function isTrackingParam(name: string): boolean {
  const key = name.toLowerCase();
  return TRACKING_PARAMS.has(key) || key.startsWith("utm_");
}

function instagramShortcode(host: string, pathname: string): string | null {
  if (host !== "instagram.com" && host !== "instagr.am") return null;
  const match = pathname.match(/^\/(?:p|reel|reels|tv)\/([^/]+)\/?/i);
  return match ? `instagram.com/p/${match[1]}` : null;
}

function tiktokVideo(host: string, pathname: string): string | null {
  if (host !== "tiktok.com" && !host.endsWith(".tiktok.com")) return null;
  const match = pathname.match(/\/video\/(\d+)/);
  return match ? `tiktok.com/video/${match[1]}` : null;
}

function youtubeVideo(
  host: string,
  pathname: string,
  params: URLSearchParams
): string | null {
  const youtube =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtu.be" ||
    host === "youtube-nocookie.com";
  if (!youtube) return null;

  if (host === "youtu.be") {
    const id = pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    return id ? `youtube.com/watch/${id}` : null;
  }

  const shorts = pathname.match(/^\/shorts\/([^/]+)/i);
  if (shorts) return `youtube.com/watch/${shorts[1]}`;

  const id = params.get("v")?.trim();
  return id ? `youtube.com/watch/${id}` : null;
}
