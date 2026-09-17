import { ROLES, type Role } from "@/lib/domain/enums";

export const PERMISSIONS = [
  "creators:write",
  "contracts:write",
  "contracts:cancel",
  "contracts:renew",
  "signature:send",
  "deliverables:publish",
  "campaigns:manage",
  "finance:manage",
  "payees:read_full",
  "team:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [ROLES.ADMIN]: PERMISSIONS,
  [ROLES.CREATORS]: [
    "creators:write",
    "contracts:write",
    "contracts:cancel",
    "contracts:renew",
    "signature:send",
    "deliverables:publish",
    "campaigns:manage",
  ],
  // Contabilidad arma el lote de Zexel; el email de cobro es el dato sensible.
  [ROLES.ACCOUNTING]: ["payees:read_full", "finance:manage"],
  [ROLES.VIEWER]: [],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Tu rol no tiene el permiso "${permission}".`);
    this.name = "ForbiddenError";
  }
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError(permission);
  }
}

// Los datos bancarios solo se muestran completos a quien paga.
export function maskAccount(value: string | null | undefined): string {
  if (!value) return "—";

  const clean = value.replace(/\s+/g, "");
  if (clean.length <= 4) return "••••";

  return `${clean.slice(0, 2)}${"•".repeat(Math.max(clean.length - 6, 3))}${clean.slice(-4)}`;
}
