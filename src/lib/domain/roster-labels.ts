// Etiquetas del catálogo, sin Prisma. Los paneles de cliente importan esto;
// importar roster-catalog arrastra la base al navegador y tumba la mesa.

export function labelForSlug(
  options: { slug: string; label: string }[],
  slug: string | null | undefined
) {
  if (!slug) return null;
  return options.find((option) => option.slug === slug)?.label ?? slug;
}
