export const GENERIC_TOOL_ERROR = "No he podido hacer ese cambio.";

function isSdkInputError(text: string) {
  return (
    text.includes("Invalid input for tool") ||
    text.includes("AI_InvalidToolInputError") ||
    text.includes("Type validation failed") ||
    text.includes("Invalid schema")
  );
}

/** El modelo no recibe el texto del validador del SDK. */
export function publicAgentError(text: string) {
  return isSdkInputError(text) ? GENERIC_TOOL_ERROR : text;
}

export function sanitizeModelMessages<T>(messages: T[]): T[] {
  return messages.map((message) => {
    if (!message || typeof message !== "object") return message;
    const record = message as { role?: string; content?: unknown };
    if (record.role !== "tool" || !Array.isArray(record.content)) return message;
    return {
      ...record,
      content: record.content.map((part) => {
        if (!part || typeof part !== "object") return part;
        const item = part as { type?: string; output?: unknown };
        if (item.type !== "tool-result" || !item.output || typeof item.output !== "object") {
          return part;
        }
        const output = item.output as { type?: string; value?: unknown };
        if (output.type !== "error-text" && output.type !== "error-json") return part;
        const text =
          typeof output.value === "string" ? output.value : JSON.stringify(output.value ?? "");
        if (!isSdkInputError(text)) return part;
        return { ...item, output: { type: "error-text", value: GENERIC_TOOL_ERROR } };
      }),
    } as T;
  });
}
