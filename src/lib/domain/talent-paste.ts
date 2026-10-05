import { extractInstagramHandle } from "@/lib/domain/validation";

export const TALENT_PASTE_MAX = 200;

export function handlesFromPaste(raw: string): {
  handles: string[];
  invalid: number;
} {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const handles: string[] = [];
  const seen = new Set<string>();
  let invalid = 0;

  for (const token of tokens) {
    const handle = extractInstagramHandle(token);
    if (!handle) {
      invalid += 1;
      continue;
    }
    if (seen.has(handle)) continue;
    seen.add(handle);
    handles.push(handle);
  }

  return { handles, invalid };
}
