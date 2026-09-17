import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { getCompany } from "@/lib/company";
import { CONTRACT_KIND, paymentTermLabel } from "@/lib/domain/enums";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 56;
const LINE = 14;

// Las fuentes estándar de PDF usan WinAnsi: fuera de Latin-1 hay que sustituir
// o pdf-lib falla al escribir.
function sanitize(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\u0000-\u00FF]/g, "");
}

type Cursor = { page: PDFPage; y: number };

export type ContractPdfInput = {
  contract: {
    code: string;
    kind: string;
    deliverableCount: number;
    costCurrency: string;
    costMinorPerContent: number;
    salePriceCentsPerContent: number;
    paymentTermDays: number;
    notes: string | null;
    createdAt: Date;
    signedAt: Date | null;
  };
  parentCode?: string | null;
  creator: {
    handle: string;
    instagramUrl: string;
    displayName: string | null;
  };
  signature?: {
    signerFullName: string | null;
    signedAt: Date | null;
    signerIp: string | null;
    recipientEmail: string;
  } | null;
  payee?: {
    legalName: string;
    taxId: string;
    country: string;
    addressLine: string;
    city: string;
    postalCode: string;
    billingEmail: string;
    payoutCurrency: string;
    payoutMethod: string;
    iban: string | null;
    wiseEmail: string | null;
    accountHolder: string;
  } | null;
};

export async function buildContractPdf(
  input: ContractPdfInput
): Promise<{ bytes: Uint8Array; sha256: string }> {
  const company = getCompany();
  const document = await PDFDocument.create();

  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  document.setTitle(`Contrato ${input.contract.code}`);
  document.setAuthor(company.legalName);
  document.setSubject("Contrato de creación de contenido");
  // Sin fechas de creación variables: así el PDF es reproducible y su hash
  // sirve para verificar lo firmado.
  document.setCreationDate(input.contract.createdAt);
  document.setModificationDate(input.contract.signedAt ?? input.contract.createdAt);

  const cursor: Cursor = {
    page: document.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
  };

  function ensureSpace(needed: number) {
    if (cursor.y - needed < MARGIN) {
      cursor.page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursor.y = PAGE_HEIGHT - MARGIN;
    }
  }

  function wrap(text: string, font: PDFFont, size: number, width: number) {
    const words = sanitize(text).split(/\s+/);
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }

    if (current) lines.push(current);
    return lines;
  }

  function paragraph(
    text: string,
    options: { font?: PDFFont; size?: number; gap?: number; color?: [number, number, number] } = {}
  ) {
    const font = options.font ?? regular;
    const size = options.size ?? 10;
    const lines = wrap(text, font, size, PAGE_WIDTH - MARGIN * 2);

    for (const line of lines) {
      ensureSpace(LINE);
      cursor.page.drawText(line, {
        x: MARGIN,
        y: cursor.y,
        size,
        font,
        color: options.color
          ? rgb(options.color[0], options.color[1], options.color[2])
          : rgb(0.1, 0.1, 0.1),
      });
      cursor.y -= LINE;
    }

    cursor.y -= options.gap ?? 6;
  }

  function heading(text: string) {
    ensureSpace(LINE * 2);
    cursor.y -= 4;
    paragraph(text, { font: bold, size: 11, gap: 4 });
  }

  function keyValue(label: string, value: string) {
    ensureSpace(LINE);
    cursor.page.drawText(sanitize(label), {
      x: MARGIN,
      y: cursor.y,
      size: 10,
      font: bold,
      color: rgb(0.35, 0.35, 0.35),
    });
    const labelWidth = 160;
    const lines = wrap(value, regular, 10, PAGE_WIDTH - MARGIN * 2 - labelWidth);

    lines.forEach((line, index) => {
      if (index > 0) {
        cursor.y -= LINE;
        ensureSpace(LINE);
      }
      cursor.page.drawText(line, {
        x: MARGIN + labelWidth,
        y: cursor.y,
        size: 10,
        font: regular,
        color: rgb(0.1, 0.1, 0.1),
      });
    });

    cursor.y -= LINE;
  }

  function rule() {
    ensureSpace(10);
    cursor.page.drawLine({
      start: { x: MARGIN, y: cursor.y + 6 },
      end: { x: PAGE_WIDTH - MARGIN, y: cursor.y + 6 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.85),
    });
    cursor.y -= 8;
  }

  const isAnnex = input.contract.kind === CONTRACT_KIND.ANNEX;
  const totalCost =
    input.contract.costMinorPerContent * input.contract.deliverableCount;

  // --- Encabezado ---
  paragraph(
    isAnnex
      ? `ANEXO AL CONTRATO ${input.parentCode ?? ""}`.trim()
      : "CONTRATO DE PRESTACIÓN DE SERVICIOS DE CREACIÓN DE CONTENIDO",
    { font: bold, size: 14, gap: 2 }
  );
  paragraph(
    `Referencia ${input.contract.code} · ${formatDate(input.contract.createdAt)}`,
    { size: 9, color: [0.4, 0.4, 0.4], gap: 10 }
  );
  rule();

  // --- Partes ---
  heading("1. Partes");
  paragraph(
    `De una parte, ${company.legalName}, con NIF ${company.taxId} y domicilio en ${company.address} (en adelante, "la Empresa").`
  );

  if (input.payee) {
    paragraph(
      `Y de otra, ${input.payee.legalName}, con identificación fiscal ${input.payee.taxId} y domicilio en ${input.payee.addressLine}, ${input.payee.postalCode} ${input.payee.city}, ${input.payee.country} (en adelante, "el Creador"), titular o representante de la cuenta de Instagram @${input.creator.handle}.`
    );
  } else {
    paragraph(
      `Y de otra, el titular de la cuenta de Instagram @${input.creator.handle}${
        input.creator.displayName ? ` (${input.creator.displayName})` : ""
      } (en adelante, "el Creador"), cuyos datos identificativos y fiscales se incorporarán al presente documento en el momento de la firma.`
    );
  }

  // --- Objeto ---
  heading(isAnnex ? "2. Objeto del anexo" : "2. Objeto");
  if (isAnnex) {
    paragraph(
      `Las partes acuerdan ampliar el contrato ${input.parentCode ?? ""} con ${input.contract.deliverableCount} contenido(s) adicional(es), manteniendo inalteradas las condiciones económicas por contenido y el resto de estipulaciones del contrato original.`
    );
  } else {
    paragraph(
      `El Creador se compromete a producir y publicar ${input.contract.deliverableCount} contenido(s) en su cuenta de Instagram ${input.creator.instagramUrl}, conforme a las indicaciones y calendario acordados con la Empresa.`
    );
  }

  // --- Condiciones económicas ---
  heading("3. Condiciones económicas");
  keyValue("Contenidos", String(input.contract.deliverableCount));
  keyValue(
    "Importe por contenido",
    formatMoney(input.contract.costMinorPerContent, input.contract.costCurrency, {
      withCode: true,
    })
  );
  keyValue(
    "Importe total",
    formatMoney(totalCost, input.contract.costCurrency, { withCode: true })
  );
  keyValue(
    "Plazo de pago",
    `${paymentTermLabel(input.contract.paymentTermDays)} desde la publicación de cada contenido`
  );
  cursor.y -= 4;
  paragraph(
    input.contract.paymentTermDays === 0
      ? "El pago de cada contenido se hará efectivo de forma inmediata tras su publicación, previa recepción de la factura correspondiente cuando resulte exigible."
      : `El pago de cada contenido se hará efectivo dentro de los ${input.contract.paymentTermDays} días siguientes a su publicación, previa recepción de la factura correspondiente cuando resulte exigible.`
  );
  paragraph(
    "Los importes indicados son base imponible. Los impuestos indirectos y las retenciones aplicables se añadirán o practicarán conforme a la normativa vigente y al régimen fiscal declarado por el Creador."
  );

  // --- Condiciones particulares ---
  if (input.contract.notes) {
    heading("4. Condiciones particulares");
    paragraph(input.contract.notes);
  }

  // --- Datos de pago ---
  if (input.payee) {
    heading(input.contract.notes ? "5. Datos de pago" : "4. Datos de pago");
    keyValue("Titular", input.payee.accountHolder);
    keyValue(
      "Método",
      input.payee.payoutMethod === "WISE" ? "Wise" : "Transferencia bancaria"
    );
    keyValue(
      input.payee.payoutMethod === "WISE" ? "Cuenta Wise" : "IBAN",
      (input.payee.payoutMethod === "WISE"
        ? input.payee.wiseEmail
        : input.payee.iban) ?? "-"
    );
    keyValue("Moneda de pago", input.payee.payoutCurrency);
    keyValue("Email de facturación", input.payee.billingEmail);
  }

  // --- Firma ---
  rule();
  heading("Firma");

  if (input.signature?.signedAt) {
    paragraph(
      `Documento aceptado y firmado electrónicamente por ${input.signature.signerFullName ?? input.signature.recipientEmail}.`
    );
    keyValue("Fecha y hora (UTC)", formatDateTime(input.signature.signedAt));
    keyValue("Email del firmante", input.signature.recipientEmail);
    keyValue("Dirección IP", input.signature.signerIp ?? "no registrada");
    cursor.y -= 4;
    paragraph(
      "La firma se ha realizado mediante aceptación expresa en el enlace privado remitido al firmante. Este documento incorpora la huella digital SHA-256 que permite verificar que su contenido no ha sido alterado.",
      { size: 9, color: [0.4, 0.4, 0.4] }
    );
  } else {
    paragraph(
      "Pendiente de firma. Este documento es un borrador y no produce efectos hasta que el Creador lo acepte mediante el enlace de firma facilitado por la Empresa.",
      { color: [0.55, 0.15, 0.15] }
    );
  }

  paragraph(
    `${company.legalName} · ${company.email}`,
    { size: 9, color: [0.4, 0.4, 0.4], gap: 0 }
  );

  const bytes = await document.save();
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  return { bytes, sha256 };
}
