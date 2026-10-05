export function fieldDescribedBy(
  id: string,
  options: { description?: boolean; error?: boolean }
) {
  const descriptionId = options.description ? `${id}-description` : undefined;
  const errorId = options.error ? `${id}-error` : undefined;
  const describedBy =
    [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return { descriptionId, errorId, describedBy };
}
