import { prisma } from "@/lib/db";

export const ROSTER_OPTION_KIND = {
  COUNTRY: "COUNTRY",
  PROFILE_TYPE: "PROFILE_TYPE",
} as const;

export type RosterOptionKind =
  (typeof ROSTER_OPTION_KIND)[keyof typeof ROSTER_OPTION_KIND];

export type RosterCatalogOption = {
  id: string;
  kind: RosterOptionKind;
  slug: string;
  label: string;
  aliases: string[];
  archived: boolean;
};

export type RosterCatalog = {
  countries: RosterCatalogOption[];
  profileTypes: RosterCatalogOption[];
};

export function normalizeCatalogKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseAliases(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => normalizeCatalogKey(item))
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function optionKeys(option: Pick<RosterCatalogOption, "slug" | "label" | "aliases">) {
  return [
    ...new Set(
      [option.slug, option.label, ...option.aliases]
        .map((item) => normalizeCatalogKey(item))
        .filter(Boolean)
    ),
  ];
}

export function optionMatches(option: RosterCatalogOption, raw: string) {
  const key = normalizeCatalogKey(raw);
  if (!key) return false;
  return optionKeys(option).includes(key);
}

export function collidingCatalogKey(
  options: Array<Pick<RosterCatalogOption, "id" | "slug" | "label" | "aliases">>,
  keys: string[],
  exceptId?: string
) {
  const wanted = new Set(
    keys.map((item) => normalizeCatalogKey(item)).filter(Boolean)
  );
  for (const option of options) {
    if (exceptId && option.id === exceptId) continue;
    for (const key of optionKeys(option)) {
      if (wanted.has(key)) return key;
    }
  }
  return null;
}

export function storedValuesForFilter(
  options: RosterCatalogOption[],
  raw: string
) {
  const resolved = resolveCatalogOption(options, raw);
  const option =
    resolved.ok && resolved.option
      ? resolved.option
      : options.find((item) => item.slug === raw);
  if (!option) return [raw];
  return [...new Set([option.slug, option.label, ...option.aliases, raw])];
}

export function catalogSearchValues(catalog: RosterCatalog, query: string) {
  const values = new Set<string>([query]);
  for (const option of [...catalog.countries, ...catalog.profileTypes]) {
    if (optionMatches(option, query)) {
      values.add(option.slug);
      values.add(option.label);
      for (const alias of option.aliases) values.add(alias);
    }
  }
  return [...values];
}

export function resolveCatalogOption(
  options: RosterCatalogOption[],
  raw: string | null | undefined
):
  | { ok: true; option: RosterCatalogOption | null }
  | { ok: false; value: string } {
  const value = raw?.trim() ?? "";
  if (!value) return { ok: true, option: null };
  const match = options.find((option) => optionMatches(option, value));
  if (!match) return { ok: false, value };
  return { ok: true, option: match };
}

export function labelForSlug(
  options: RosterCatalogOption[],
  slug: string | null | undefined
) {
  if (!slug) return null;
  return options.find((option) => option.slug === slug)?.label ?? slug;
}

const DEFAULT_COUNTRIES: { label: string; aliases: string[] }[] = [
  { label: "España", aliases: ["es", "spain", "espana", "esp"] },
  { label: "México", aliases: ["mx", "mexico", "mex"] },
  { label: "Colombia", aliases: ["co", "colombia"] },
  { label: "Argentina", aliases: ["ar", "argentina"] },
  { label: "Chile", aliases: ["cl", "chile"] },
  { label: "Perú", aliases: ["pe", "peru"] },
  { label: "Brasil", aliases: ["br", "brasil", "brazil"] },
  { label: "Estados Unidos", aliases: ["us", "usa", "eeuu", "united_states"] },
  { label: "Reino Unido", aliases: ["uk", "gb", "united_kingdom", "inglaterra"] },
  { label: "Francia", aliases: ["fr", "france"] },
  { label: "Italia", aliases: ["it", "italia", "italy"] },
  { label: "Alemania", aliases: ["de", "alemania", "germany"] },
  { label: "Portugal", aliases: ["pt", "portugal"] },
];

const DEFAULT_PROFILE_TYPES: { label: string; aliases: string[] }[] = [
  { label: "UGC", aliases: ["ugc_creator"] },
  { label: "Nano", aliases: ["nanoinfluencer"] },
  { label: "Micro", aliases: ["microinfluencer"] },
  { label: "Mid", aliases: ["midtier", "mid_tier"] },
  { label: "Macro", aliases: ["macroinfluencer"] },
  { label: "Celebrity", aliases: ["celebridad", "famoso"] },
  { label: "Lifestyle", aliases: [] },
  { label: "Tech", aliases: ["tecnologia", "tecnología"] },
  { label: "Beauty", aliases: ["belleza"] },
  { label: "Gaming", aliases: ["gamer"] },
  { label: "Fitness", aliases: ["gym", "deporte"] },
  { label: "Food", aliases: ["comida", "foodie"] },
];

async function insertDefaults(
  kind: RosterOptionKind,
  defaults: { label: string; aliases: string[] }[]
) {
  for (const [index, item] of defaults.entries()) {
    const slug = normalizeCatalogKey(item.label);
    await prisma.rosterOption.upsert({
      where: { kind_slug: { kind, slug } },
      create: {
        kind,
        slug,
        label: item.label,
        aliases: JSON.stringify(
          item.aliases.map((alias) => normalizeCatalogKey(alias))
        ),
        sortOrder: index,
      },
      update: {},
    });
  }
}

export async function ensureRosterCatalog() {
  const count = await prisma.rosterOption.count();
  if (count > 0) return;
  await insertDefaults(ROSTER_OPTION_KIND.COUNTRY, DEFAULT_COUNTRIES);
  await insertDefaults(ROSTER_OPTION_KIND.PROFILE_TYPE, DEFAULT_PROFILE_TYPES);
}

function toOption(row: {
  id: string;
  kind: string;
  slug: string;
  label: string;
  aliases: string;
  archivedAt: Date | null;
}): RosterCatalogOption {
  return {
    id: row.id,
    kind: row.kind as RosterOptionKind,
    slug: row.slug,
    label: row.label,
    aliases: parseAliases(row.aliases),
    archived: Boolean(row.archivedAt),
  };
}

export async function loadRosterCatalog(): Promise<RosterCatalog> {
  await ensureRosterCatalog();
  const rows = await prisma.rosterOption.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  const live = rows.map(toOption).filter((option) => !option.archived);
  return {
    countries: live.filter((option) => option.kind === ROSTER_OPTION_KIND.COUNTRY),
    profileTypes: live.filter(
      (option) => option.kind === ROSTER_OPTION_KIND.PROFILE_TYPE
    ),
  };
}

export async function loadRosterCatalogAdmin(): Promise<RosterCatalog> {
  await ensureRosterCatalog();
  const rows = await prisma.rosterOption.findMany({
    orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
  });
  const all = rows.map(toOption);
  return {
    countries: all.filter((option) => option.kind === ROSTER_OPTION_KIND.COUNTRY),
    profileTypes: all.filter(
      (option) => option.kind === ROSTER_OPTION_KIND.PROFILE_TYPE
    ),
  };
}

export function resolveRosterFields(
  catalog: RosterCatalog,
  input: { country?: string | null; profileType?: string | null }
):
  | { ok: true; country: string | null; profileType: string | null }
  | { ok: false; error: string } {
  const country = resolveCatalogOption(catalog.countries, input.country);
  if (!country.ok) {
    return {
      ok: false,
      error: `País «${country.value}» no está en el catálogo. Añádelo en Creators → Listas, o pon un alias.`,
    };
  }
  const profileType = resolveCatalogOption(
    catalog.profileTypes,
    input.profileType
  );
  if (!profileType.ok) {
    return {
      ok: false,
      error: `Tipo «${profileType.value}» no está en el catálogo. Añádelo en Creators → Listas, o pon un alias.`,
    };
  }
  return {
    ok: true,
    country: country.option?.slug ?? null,
    profileType: profileType.option?.slug ?? null,
  };
}

export async function remapCreatorCatalogValues(catalog?: RosterCatalog) {
  const resolved = catalog ?? (await loadRosterCatalog());
  const countrySlugs = new Set(resolved.countries.map((item) => item.slug));
  const typeSlugs = new Set(resolved.profileTypes.map((item) => item.slug));
  const staleWhere = {
    OR: [
      { country: { not: null, notIn: [...countrySlugs] } },
      { profileType: { not: null, notIn: [...typeSlugs] } },
    ],
  };
  const pending = await prisma.creator.count({ where: staleWhere });
  if (pending === 0) return;

  const creators = await prisma.creator.findMany({
    where: staleWhere,
    select: { id: true, country: true, profileType: true },
  });

  for (const creator of creators) {
    const country = resolveCatalogOption(resolved.countries, creator.country);
    const profileType = resolveCatalogOption(
      resolved.profileTypes,
      creator.profileType
    );
    const nextCountry =
      country.ok && country.option ? country.option.slug : creator.country;
    const nextType =
      profileType.ok && profileType.option
        ? profileType.option.slug
        : creator.profileType;
    if (nextCountry === creator.country && nextType === creator.profileType) {
      continue;
    }
    await prisma.creator.update({
      where: { id: creator.id },
      data: { country: nextCountry, profileType: nextType },
    });
  }
}
