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
