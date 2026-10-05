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
  SENT: "Enviado",
  SIGNED: "Firmado",
  COMPLETED: "Completado",
  RENEWED: "Renovado",
  CANCELLED: "Cancelado",
};

export const CONTRACT_KIND = {
  ORIGINAL: "ORIGINAL",
  ANNEX: "ANNEX",
  CONDITIONS_ANNEX: "CONDITIONS_ANNEX",
  RENEWAL: "RENEWAL",
} as const;

export type ContractKind = (typeof CONTRACT_KIND)[keyof typeof CONTRACT_KIND];

export const CONTRACT_KIND_LABELS: Record<ContractKind, string> = {
  ORIGINAL: "Contrato inicial",
  ANNEX: "Anexo de contenidos",
  CONDITIONS_ANNEX: "Anexo de condiciones",
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
  PENDING: "Pendiente",
  SCHEDULED: "Programado",
  PUBLISHED: "Publicado",
  SUBMITTED: "Subido al cliente",
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

// Contents opera hasta Publicado. En plataforma lo marca Finanzas.
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
  ACTIVE: "En curso",
  CLOSED: "Cerrada",
};

export const CAMPAIGN_ENGAGEMENT = {
  SLATE: "SLATE",
  BUDGET: "BUDGET",
  ALWAYS_ON: "ALWAYS_ON",
} as const;

export type CampaignEngagement =
  (typeof CAMPAIGN_ENGAGEMENT)[keyof typeof CAMPAIGN_ENGAGEMENT];

export const CAMPAIGN_ENGAGEMENT_LABELS: Record<CampaignEngagement, string> = {
  SLATE: "Paquete cerrado",
  BUDGET: "Presupuesto",
  ALWAYS_ON: "Always-on",
};

export const CAMPAIGN_ENGAGEMENT_HINTS: Record<CampaignEngagement, string> = {
  SLATE: "Un lote concreto. Se pueden mandar oleadas, la campaña no se cierra sola.",
  BUDGET: "Hay un sobre en USD. Las líneas van comiendo del presupuesto.",
  ALWAYS_ON: "Se siguen metiendo y repitiendo perfiles. No hay cierre por lote.",
};

export const CAMPAIGN_APPROVAL = {
  INTERNAL: "INTERNAL",
  CLIENT_APPROVES: "CLIENT_APPROVES",
} as const;

export type CampaignApproval =
  (typeof CAMPAIGN_APPROVAL)[keyof typeof CAMPAIGN_APPROVAL];

export const CAMPAIGN_APPROVAL_LABELS: Record<CampaignApproval, string> = {
  INTERNAL: "Uso interno",
  CLIENT_APPROVES: "La agencia anota el sí",
};

export const CAMPAIGN_APPROVAL_HINTS: Record<CampaignApproval, string> = {
  INTERNAL: "No hay ok del cliente. Si la línea está lista, se puede activar.",
  CLIENT_APPROVES:
    "El sí o el no se escribe aquí porque se habló en el hilo. El cliente no entra a la mesa.",
};

export const PROPOSAL_STATUS = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  CLOSED: "CLOSED",
} as const;

export type ProposalStatus =
  (typeof PROPOSAL_STATUS)[keyof typeof PROPOSAL_STATUS];

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  CLOSED: "Cerrada",
};

export const CAMPAIGN_TALENT_STATUS = {
  ROSTER: "ROSTER",
  READY: "READY",
  PROPOSED: "PROPOSED",
  APPROVED: "APPROVED",
  ACTIVE: "ACTIVE",
  REJECTED: "REJECTED",
} as const;

export type CampaignTalentStatus =
  (typeof CAMPAIGN_TALENT_STATUS)[keyof typeof CAMPAIGN_TALENT_STATUS];

export const CAMPAIGN_TALENT_STATUS_LABELS: Record<CampaignTalentStatus, string> =
  {
    ROSTER: "Roster",
    READY: "Listo",
    PROPOSED: "Propuesto",
    APPROVED: "Aprobado",
    ACTIVE: "Activo",
    REJECTED: "Rechazado",
  };

export const CAMPAIGN_TALENT_STATUS_HINTS: Record<CampaignTalentStatus, string> =
  {
    ROSTER: "En la campaña, todavía sin piezas o precios.",
    READY: "Piezas y precios puestos. Se puede activar o meter en una oleada.",
    PROPOSED: "Oleada marcada como enviada. El cliente no la abre.",
    APPROVED: "La agencia registró el sí. Falta activar el contrato.",
    ACTIVE: "Ya opera en esta pasada.",
    REJECTED: "No entra en esta pasada.",
  };

export const ROSTER_IMPORT_MAX_ROWS = 2000;

export const SIGNATURE_STATUS = {
  PENDING: "PENDING",
  VIEWED: "VIEWED",
  SIGNED: "SIGNED",
  REVOKED: "REVOKED",
} as const;

export type SignatureStatus =
  (typeof SIGNATURE_STATUS)[keyof typeof SIGNATURE_STATUS];

export const SIGNATURE_STATUS_LABELS: Record<SignatureStatus, string> = {
  PENDING: "Pendiente",
  VIEWED: "Visto, sin firmar",
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

export const MAIL_JOB_KIND = {
  SIGNATURE: "SIGNATURE",
} as const;

export type MailJobKind = (typeof MAIL_JOB_KIND)[keyof typeof MAIL_JOB_KIND];

export const MAIL_JOB_STATUS = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;

export type MailJobStatus = (typeof MAIL_JOB_STATUS)[keyof typeof MAIL_JOB_STATUS];

export const LIST_PAGE_SIZE = 50;
export const FINANCE_PAGE_SIZE = 50;
export const FINANCE_MAX_IDS = 100;
export const MAIL_PROCESS_BATCH = 20;
export const SIGNATURE_FILTER_BATCH = 80;
export const ASSIGN_FILTER_BATCH = 200;
export const IMPORT_MAX_ROWS = 200;
export const CREATOR_SEARCH_LIMIT = 20;
