export const ROLES = {
  ADMIN: "ADMIN",
  CREATORS: "CREATORS",
  ACCOUNTING: "ACCOUNTING",
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin / Finanzas",
  CREATORS: "Gestión de creators",
  ACCOUNTING: "Contabilidad / Pagos",
  VIEWER: "Lectura",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Acceso completo, incluida la gestión del equipo.",
  CREATORS:
    "Da de alta creators y contratos, envía a firma y marca contenidos publicados.",
  ACCOUNTING:
    "Sube a plataforma los de clientes que lo piden, arma el lote de Zexel y marca pagado.",
  VIEWER: "Solo lectura, con los datos bancarios ocultos.",
};

export const CONTRACT_STATUS = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  SIGNED: "SIGNED",
  COMPLETED: "COMPLETED",
  RENEWED: "RENEWED",
  CANCELLED: "CANCELLED",
} as const;

export type ContractStatus =
  (typeof CONTRACT_STATUS)[keyof typeof CONTRACT_STATUS];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviado a firma",
  SIGNED: "Vigente",
  COMPLETED: "Completado",
  RENEWED: "Renovado",
  CANCELLED: "Cancelado",
};

export const CONTRACT_KIND = {
  ORIGINAL: "ORIGINAL",
  ANNEX: "ANNEX",
  RENEWAL: "RENEWAL",
} as const;

export type ContractKind = (typeof CONTRACT_KIND)[keyof typeof CONTRACT_KIND];

export const CONTRACT_KIND_LABELS: Record<ContractKind, string> = {
  ORIGINAL: "Contrato inicial",
  ANNEX: "Anexo",
  RENEWAL: "Renovación",
};

export const DELIVERABLE_STATUS = {
  PENDING: "PENDING",
  SCHEDULED: "SCHEDULED",
  PUBLISHED: "PUBLISHED",
  SUBMITTED: "SUBMITTED",
} as const;

export type DeliverableStatus =
  (typeof DELIVERABLE_STATUS)[keyof typeof DELIVERABLE_STATUS];

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  PENDING: "Sin agendar",
  SCHEDULED: "Agendado",
  PUBLISHED: "Publicado",
  SUBMITTED: "Submitted",
};

export const DELIVERABLE_STATUS_HINTS: Record<DeliverableStatus, string> = {
  PENDING: "Todavía sin fecha.",
  SCHEDULED: "Con fecha de publicación.",
  PUBLISHED: "Ya está publicado en redes.",
  SUBMITTED:
    "Finanzas ya lo puso en la plataforma del cliente: se puede pagar al perfil.",
};

export const DELIVERABLE_STATUS_ORDER: DeliverableStatus[] = [
  "PENDING",
  "SCHEDULED",
  "PUBLISHED",
  "SUBMITTED",
];

// Contents opera hasta Publicado. Submitted lo marca Finanzas.
export const OPS_DELIVERABLE_STATUSES: DeliverableStatus[] = [
  "PENDING",
  "SCHEDULED",
  "PUBLISHED",
];

export const SETTLEMENT_MODE = {
  PER_CONTENT: "PER_CONTENT",
  PACK: "PACK",
} as const;

export type SettlementMode =
  (typeof SETTLEMENT_MODE)[keyof typeof SETTLEMENT_MODE];

export const SETTLEMENT_MODE_LABELS: Record<SettlementMode, string> = {
  PER_CONTENT: "Por contenido",
  PACK: "Al cerrar el pack",
};

export const SETTLEMENT_MODE_HINTS: Record<SettlementMode, string> = {
  PER_CONTENT:
    "Cada pieza publicada se liquida por separado (como Higgsfield).",
  PACK: "No se cobra ni se paga hasta que ese perfil termine todos los contenidos de la campaña.",
};

export const CAMPAIGN_STATUS = {
  ACTIVE: "ACTIVE",
  CLOSED: "CLOSED",
} as const;

export type CampaignStatus =
  (typeof CAMPAIGN_STATUS)[keyof typeof CAMPAIGN_STATUS];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  ACTIVE: "Activa",
  CLOSED: "Cerrada",
};

export const SIGNATURE_STATUS = {
  PENDING: "PENDING",
  VIEWED: "VIEWED",
  SIGNED: "SIGNED",
  REVOKED: "REVOKED",
} as const;

export type SignatureStatus =
  (typeof SIGNATURE_STATUS)[keyof typeof SIGNATURE_STATUS];

export const SIGNATURE_STATUS_LABELS: Record<SignatureStatus, string> = {
  PENDING: "Pendiente de firma",
  VIEWED: "Abierto por el firmante",
  SIGNED: "Firmado",
  REVOKED: "Revocado",
};

export const PAYEE_KIND = {
  INDIVIDUAL: "INDIVIDUAL",
  COMPANY: "COMPANY",
  AGENCY: "AGENCY",
} as const;

export type PayeeKind = (typeof PAYEE_KIND)[keyof typeof PAYEE_KIND];

export const PAYEE_KIND_LABELS: Record<PayeeKind, string> = {
  INDIVIDUAL: "Persona física / autónomo",
  COMPANY: "Sociedad del propio talento",
  AGENCY: "Agencia o management",
};

export const PAYOUT_METHOD = {
  ZEXEL: "ZEXEL",
  BANK_TRANSFER: "BANK_TRANSFER",
  WISE: "WISE",
} as const;

export type PayoutMethod = (typeof PAYOUT_METHOD)[keyof typeof PAYOUT_METHOD];

export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  ZEXEL: "Zexel Pay",
  BANK_TRANSFER: "Transferencia bancaria",
  WISE: "Wise",
};

export const RECIPIENT_KIND = {
  TALENT: "TALENT",
  AGENCY: "AGENCY",
} as const;

export type RecipientKind = (typeof RECIPIENT_KIND)[keyof typeof RECIPIENT_KIND];

// Plazos habituales; el formulario permite además un número libre de días.
export const PAYMENT_TERMS = [
  { days: 0, label: "Inmediato" },
  { days: 7, label: "7 días" },
  { days: 15, label: "15 días" },
  { days: 30, label: "30 días" },
  { days: 45, label: "45 días" },
  { days: 60, label: "60 días" },
] as const;

export function paymentTermLabel(days: number) {
  const known = PAYMENT_TERMS.find((term) => term.days === days);
  return known ? known.label : `${days} días`;
}
