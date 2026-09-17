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
  return deliverables.filter((item) => isLiveDeliverable(item.status)).length;
}

// Publicado en redes, esté o no ya en la plataforma del cliente.
export function isLiveDeliverable(status: string): boolean {
  return (
    status === DELIVERABLE_STATUS.PUBLISHED ||
    status === DELIVERABLE_STATUS.SUBMITTED
  );
}

// Solo cuando Finanzas lo ha subido a la plataforma del cliente.
export function isPayableDeliverable(status: string): boolean {
  return status === DELIVERABLE_STATUS.SUBMITTED;
}

export type DeliverableStateInput = {
  status: string;
  previousStatus?: string;
  contentDate: Date | null;
  postUrl?: string | null;
  paymentTermDays: number;
  // En liquidación por pack no se pone fecha de pago al publicar.
  deferPayment?: boolean;
};

export type DeliverableState = {
  status: string;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  paymentDueAt: Date | null;
};

function hasPostUrl(value: string | null | undefined) {
  return Boolean(value?.trim());
}

// Mantiene coherentes estado, fecha y enlace. Hay una sola fecha de contenido:
// si está agendado es la prevista; si ya está en redes, la de publicación.
export function resolveDeliverableState(
  input: DeliverableStateInput
): { ok: true; value: DeliverableState } | { ok: false; error: string } {
  const { contentDate, paymentTermDays } = input;
  let { status } = input;

  // Poner una fecha dejando el desplegable en «Sin agendar» equivale a
  // agendar. Si el usuario elige «Sin agendar» sobre un contenido que ya
  // estaba agendado, se limpia la fecha (abajo).
  if (
    status === DELIVERABLE_STATUS.PENDING &&
    contentDate &&
    (input.previousStatus ?? DELIVERABLE_STATUS.PENDING) ===
      DELIVERABLE_STATUS.PENDING
  ) {
    status = DELIVERABLE_STATUS.SCHEDULED;
  }

  if (
    status === DELIVERABLE_STATUS.PUBLISHED ||
    status === DELIVERABLE_STATUS.SUBMITTED
  ) {
    if (!contentDate) {
      return {
        ok: false,
        error:
          status === DELIVERABLE_STATUS.SUBMITTED
            ? "Para marcarlo como submitted hace falta la fecha."
            : "Para marcarlo como publicado hace falta la fecha.",
      };
    }

    if (!hasPostUrl(input.postUrl)) {
      return {
        ok: false,
        error:
          status === DELIVERABLE_STATUS.SUBMITTED
            ? "Para marcarlo como submitted hace falta el enlace del contenido."
            : "Para marcarlo como publicado hace falta el enlace del contenido.",
      };
    }

    const paymentDueAt = input.deferPayment
      ? null
      : (() => {
          const due = new Date(contentDate);
          due.setUTCDate(due.getUTCDate() + paymentTermDays);
          return due;
        })();

    return {
      ok: true,
      value: {
        status,
        scheduledFor: contentDate,
        publishedAt: contentDate,
        paymentDueAt,
      },
    };
  }

  if (status === DELIVERABLE_STATUS.SCHEDULED && !contentDate) {
    return {
      ok: false,
      error: "Para agendarlo hace falta una fecha.",
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
    value: {
      status,
      scheduledFor: contentDate,
      publishedAt: null,
      paymentDueAt: null,
    },
  };
}

// Un contenido agendado cuya fecha ya pasó y sigue sin publicarse.
export function isDeliverableLate(
  deliverable: { status: string; scheduledFor: Date | null },
  now = new Date()
): boolean {
  if (isLiveDeliverable(deliverable.status)) return false;
  if (!deliverable.scheduledFor) return false;

  return deliverable.scheduledFor < now;
}
