import { CONTRACT_KIND } from "@/lib/domain/enums";

// Texto jurídico del PDF. Vive aquí para poder probarlo y para que Legal
// sepa dónde tocarlo. El PDF solo maqueta. Latin-1 (WinAnsi): tildes sí, emojis no.

export function organicObjectCopy(input: {
  kind: string;
  parentCode?: string | null;
  deliverableCount: number;
  instagramUrl: string;
}): string {
  if (input.kind === CONTRACT_KIND.CONDITIONS_ANNEX) {
    return `Las partes modifican las condiciones particulares del contrato ${input.parentCode ?? "de origen"}. El número de contenidos, los importes, el plazo de pago y el resto de estipulaciones del contrato original permanecen vigentes, salvo lo que este anexo disponga de forma expresa.`;
  }

  if (input.kind === CONTRACT_KIND.ANNEX) {
    return `Las partes acuerdan ampliar el contrato ${input.parentCode ?? ""} con ${input.deliverableCount} contenido(s) adicional(es) de carácter orgánico, manteniendo inalteradas las condiciones económicas por contenido y el resto de estipulaciones del contrato original, salvo las condiciones particulares que se indiquen.`;
  }

  return `El Creador se obliga a producir y publicar ${input.deliverableCount} contenido(s) orgánico(s) en su cuenta de Instagram ${input.instagramUrl} (feed, stories, reels u otros formatos nativos), conforme al brief, indicaciones y calendario acordados con la Empresa. Este contrato cubre esa publicación orgánica en el perfil del Creador.`;
}

export const dmAutomationCopy =
  "El Creador se obliga a instalar, mantener activa y no alterar, durante la vigencia de este contrato, la herramienta de automatización de mensajes directos que la Empresa indique para la campaña (Many Chat u otra equivalente). La Empresa o el cliente final facilitarán la configuración y los flujos. El Creador no desactivará la herramienta ni modificará los flujos sin acuerdo previo por escrito.";

export const paidMediaCopy =
  "El precio pactado retribuye únicamente la creación y la publicación orgánica en el perfil del Creador. Quedan excluidos, salvo negociación y precio adicionales por escrito: pauta o paid media, impulso de contenidos, partnership ads, whitelisting, spark ads, cesión del contenido para anuncios y cualquier otra difusión de pago. Si el cliente o la Empresa quisieran ese uso, se negociará aparte.";

export const paymentRuleCopy =
  "Se paga según lo negociado en este documento: el precio por contenido, el importe total, la moneda y el plazo del apartado de condiciones económicas. No se aplican tarifas ni plazos distintos salvo pacto posterior por escrito.";

export const creatorDutiesCopy =
  "El Creador declara ser titular o estar facultado para contratar sobre la cuenta de Instagram indicada. Publicará las piezas en esa cuenta, en las fechas acordadas, respetando las normas de la plataforma, el brief y la legislación aplicable (incluida la identificación de contenidos comerciales cuando proceda). No contratará engagement artificial ni ocultará la relación comercial. Comunicará a la Empresa cualquier incidencia que impida publicar o mantener la herramienta de mensajes directos.";

export const companyDutiesCopy =
  "La Empresa abonará al Creador los importes en el plazo y forma pactados, previa recepción de la factura cuando resulte exigible, y le facilitará el brief, materiales y la configuración de la herramienta de mensajes directos cuando corresponda.";

export const ipCopy =
  "El Creador conserva la titularidad de los contenidos. Concede a la Empresa y al cliente final una licencia no exclusiva para su exhibición orgánica en el perfil del Creador y para reportes internos de campaña. Cualquier uso publicitario de pago o cesión a terceros requiere el pacto adicional del apartado de paid media.";

export const durationCopy =
  "El contrato produce efectos desde la firma hasta la publicación de los contenidos pactados o hasta la fecha de fin de campaña que las partes acuerden. Cualquiera de las partes podrá resolverlo por incumplimiento grave no subsanado en diez días desde el requerimiento escrito.";

export const privacyCopy =
  "Los datos identificativos, fiscales y de cobro del Creador se tratan para ejecutar este contrato, el pago y las obligaciones legales, conforme al Reglamento (UE) 2016/679 y a la normativa española de protección de datos.";

export const governingLawCopy =
  "Este contrato se rige por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales de Madrid, con renuncia a cualquier otro fuero que pudiera corresponderles.";

export const signSummaryBullets = [
  "El precio cubre la creación y la publicación orgánica en el perfil. Paid media, pauta, whitelisting o cesión para anuncios se negocian aparte.",
  "El Creador instalará y mantendrá activa la automatización de mensajes directos (Many Chat u otra herramienta equivalente) que indique la Empresa.",
  "Se paga según el precio, la moneda y el plazo negociados en este documento.",
];
