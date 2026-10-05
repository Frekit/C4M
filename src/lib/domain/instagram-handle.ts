// Acepta el enlace completo, con o sin www, o directamente el handle.
export function extractInstagramHandle(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  const fromUrl = value.match(
    /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?/i
  );
  const candidate = fromUrl ? fromUrl[1] : value.replace(/^@/, "");

  if (!/^[A-Za-z0-9._]{1,30}$/.test(candidate)) {
    return null;
  }

  return candidate.toLowerCase();
}
