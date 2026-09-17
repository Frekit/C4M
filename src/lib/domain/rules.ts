import { CONTRACT_STATUS, DELIVERABLE_STATUS } from "@/lib/domain/enums";

// Las reglas de negocio viven aquí, fuera de los formularios, para poder
// probarlas sin levantar la aplicación.

export type CostTerms = {
  costCurrency: string;
  costMinorPerContent: number;
};

// Un anexo solo vale si el coste del creator no se toca. Si cambia el importe o
// la moneda, hay que firmar un contrato nuevo de renovación.
export function isAnnexAllowed(parent: CostTerms, next: CostTerms): boolean {
  return (
    parent.costCurrency === next.costCurrency &&
    parent.costMinorPerContent === next.costMinorPerContent
  );
}

// Sin contrato firmado no se marca nada como publicado: devengaría dinero sin
// acuerdo firmado.
export function canPublishDeliverables(contractStatus: string): boolean {
  return (
    contractStatus === CONTRACT_STATUS.SIGNED ||
    contractStatus === CONTRACT_STATUS.COMPLETED ||
    contractStatus === CONTRACT_STATUS.RENEWED
  );
}

export type DeletionFacts = {
  status: string;
  signatureCount: number;
  publishedCount: number;
  childCount: number;
};

// Solo se borra un borrador virgen. Con firma enviada, contenidos publicados o
// contratos colgando, la única salida es cancelar.
export function canDeleteContract(facts: DeletionFacts): boolean {
  return (
    facts.status === CONTRACT_STATUS.DRAFT &&
    facts.signatureCount === 0 &&
    facts.publishedCount === 0 &&
    facts.childCount === 0
  );
}

export function countPublished(
  deliverables: { status: string }[]
): number {
  return deliverables.filter(
    (item) => item.status === DELIVERABLE_STATUS.PUBLISHED
  ).length;
}

export type DeliverableStateInput = {
  status: string;
  previousStatus?: string;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  paymentTermDays: number;
};

export type DeliverableState = {
  status: string;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  paymentDueAt: Date | null;
};

// Mantiene coherentes estado y fechas, para que no se pueda quedar un contenido
// publicado sin fecha ni un agendado con fecha de publicación.
export function resolveDeliverableState(
  input: DeliverableStateInput
): { ok: true; value: DeliverableState } | { ok: false; error: string } {
  const { scheduledFor, paymentTermDays } = input;
  let { status } = input;

  // Poner una fecha prevista dejando el desplegable en «Sin agendar» equivale
  // a agendar. Si el usuario elige «Sin agendar» sobre un contenido que ya
  // estaba agendado, se limpian las fechas (abajo).
  if (
    status === DELIVERABLE_STATUS.PENDING &&
    scheduledFor &&
    (input.previousStatus ?? DELIVERABLE_STATUS.PENDING) ===
      DELIVERABLE_STATUS.PENDING
  ) {
    status = DELIVERABLE_STATUS.SCHEDULED;
  }

  if (status === DELIVERABLE_STATUS.PUBLISHED) {
    // Si no se indica fecha de publicación, se toma la prevista.
    const publishedAt = input.publishedAt ?? scheduledFor;

    if (!publishedAt) {
      return {
        ok: false,
        error: "Para marcarlo como publicado hace falta la fecha de publicación.",
      };
    }

    const paymentDueAt = new Date(publishedAt);
    paymentDueAt.setUTCDate(paymentDueAt.getUTCDate() + paymentTermDays);

    return {
      ok: true,
      value: { status, scheduledFor, publishedAt, paymentDueAt },
    };
  }

  if (status === DELIVERABLE_STATUS.SCHEDULED && !scheduledFor) {
    return {
      ok: false,
      error: "Para agendarlo hace falta una fecha prevista.",
    };
  }

  if (status === DELIVERABLE_STATUS.PENDING) {
    return {
      ok: true,
      value: {
        status,
        scheduledFor: null,
        publishedAt: null,
        paymentDueAt: null,
      },
    };
  }

  return {
    ok: true,
    value: { status, scheduledFor, publishedAt: null, paymentDueAt: null },
  };
}

// Un contenido agendado cuya fecha ya pasó y sigue sin publicarse.
export function isDeliverableLate(
  deliverable: { status: string; scheduledFor: Date | null },
  now = new Date()
): boolean {
  if (deliverable.status === DELIVERABLE_STATUS.PUBLISHED) return false;
  if (!deliverable.scheduledFor) return false;

  return deliverable.scheduledFor < now;
}
