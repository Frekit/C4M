import { prisma } from "@/lib/db";
import { CONTRACT_KIND, type ContractKind } from "@/lib/domain/enums";

// CTR-2026-001 para contratos nuevos.
// CTR-2026-001-A1 / -R1 para anexos y renovaciones dentro de la misma cadena.
export async function nextContractCode(options: {
  kind: ContractKind;
  parentCode?: string | null;
}): Promise<string> {
  if (options.kind === CONTRACT_KIND.ORIGINAL || !options.parentCode) {
    const year = new Date().getUTCFullYear();
    const prefix = `CTR-${year}-`;

    const last = await prisma.contract.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: "desc" },
      select: { code: true },
    });

    const lastNumber = last
      ? Number.parseInt(last.code.slice(prefix.length).split("-")[0] ?? "0", 10)
      : 0;

    return `${prefix}${String(lastNumber + 1).padStart(3, "0")}`;
  }

  const rootCode = options.parentCode.replace(/-(A|R)\d+$/, "");
  const suffix = options.kind === CONTRACT_KIND.ANNEX ? "A" : "R";

  const siblings = await prisma.contract.findMany({
    where: { code: { startsWith: `${rootCode}-${suffix}` } },
    select: { code: true },
  });

  const highest = siblings.reduce((max, sibling) => {
    const parsed = Number.parseInt(
      sibling.code.slice(`${rootCode}-${suffix}`.length),
      10
    );
    return Number.isNaN(parsed) ? max : Math.max(max, parsed);
  }, 0);

  return `${rootCode}-${suffix}${highest + 1}`;
}
