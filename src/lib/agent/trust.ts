export const UNTRUSTED_OPEN = "<dato-no-fiable>";
export const UNTRUSTED_CLOSE = "</dato-no-fiable>";

/** El modelo lee esto como dato. No es una instrucción. */
export function untrusted(value: string | null | undefined) {
  const text = (value ?? "").replaceAll(UNTRUSTED_CLOSE, "");
  return `${UNTRUSTED_OPEN}${text}${UNTRUSTED_CLOSE}`;
}
