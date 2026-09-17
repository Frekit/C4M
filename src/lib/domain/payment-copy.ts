import { SETTLEMENT_MODE, paymentTermLabel } from "@/lib/domain/enums";

export type PaymentCopy = {
  term: string;
  body: string;
};

export function contractPaymentCopy(input: {
  settlementMode?: string | null;
  paymentTermDays: number;
}): PaymentCopy {
  const termLabel = paymentTermLabel(input.paymentTermDays);

  if (input.settlementMode === SETTLEMENT_MODE.PACK) {
    return {
      term: `${termLabel} desde la publicación del último contenido del pack`,
      body:
        input.paymentTermDays === 0
          ? "El pago se hará efectivo de forma inmediata cuando el Creador haya publicado todos los contenidos de la campaña asignada a su perfil, previa recepción de la factura correspondiente cuando resulte exigible. No se liquida cada pieza por separado."
          : `El pago se hará efectivo dentro de los ${input.paymentTermDays} días siguientes a la publicación del último contenido del pack de esa campaña con ese perfil. No se liquida cada pieza por separado: hasta que el pack esté completo no nace la obligación de pago, previa recepción de la factura correspondiente cuando resulte exigible.`,
    };
  }

  return {
    term: `${termLabel} desde la publicación de cada contenido`,
    body:
      input.paymentTermDays === 0
        ? "El pago de cada contenido se hará efectivo de forma inmediata tras su publicación, previa recepción de la factura correspondiente cuando resulte exigible."
        : `El pago de cada contenido se hará efectivo dentro de los ${input.paymentTermDays} días siguientes a su publicación, previa recepción de la factura correspondiente cuando resulte exigible.`,
  };
}
