import { getCompany } from "@/lib/company";
import { formatDateTime } from "@/lib/format";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(body: string): string {
  const company = getCompany();
  return `<!DOCTYPE html>
<html lang="es">
<body style="font-family: sans-serif; line-height: 1.5; color: #111;">
  ${body}
  <p style="margin-top: 24px; font-size: 12px; color: #666;">
    ${escapeHtml(company.legalName)} · ${escapeHtml(company.email)}
  </p>
</body>
</html>`;
}

export function signatureMailCopy(input: {
  handle: string;
  code: string;
  url: string;
  expiresAt: Date;
}): { subject: string; text: string; html: string } {
  const company = getCompany();
  const when = formatDateTime(input.expiresAt);
  const subject = `Firma el contrato ${input.code} (@${input.handle})`;
  const text = `Hola,

${company.legalName} te pide que revises y firmes el contrato ${input.code} para @${input.handle}.

Enlace (caduca el ${when}):
${input.url}

Si no esperabas este correo, ignóralo.`;

  const html = layout(`
    <p>Hola,</p>
    <p><strong>${escapeHtml(company.legalName)}</strong> te pide que revises y firmes el contrato <strong>${escapeHtml(input.code)}</strong> para @${escapeHtml(input.handle)}.</p>
    <p><a href="${escapeHtml(input.url)}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Abrir y firmar</a></p>
    <p style="font-size:13px;color:#555;">Caduca el ${escapeHtml(when)}. Si el botón no funciona, copia este enlace:<br>${escapeHtml(input.url)}</p>
  `);

  return { subject, text, html };
}

export function invitationMailCopy(input: {
  roleLabel: string;
  url: string;
  expiresAt: Date;
}): { subject: string; text: string; html: string } {
  const company = getCompany();
  const when = formatDateTime(input.expiresAt);
  const subject = `Invitación al equipo de ${company.legalName}`;
  const text = `Hola,

Te han invitado a ${company.legalName} con el rol ${input.roleLabel}.

Enlace (caduca el ${when}):
${input.url}

Si no esperabas este correo, ignóralo.`;

  const html = layout(`
    <p>Hola,</p>
    <p>Te han invitado a <strong>${escapeHtml(company.legalName)}</strong> con el rol <strong>${escapeHtml(input.roleLabel)}</strong>.</p>
    <p><a href="${escapeHtml(input.url)}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">Aceptar invitación</a></p>
    <p style="font-size:13px;color:#555;">Caduca el ${escapeHtml(when)}. Si el botón no funciona, copia este enlace:<br>${escapeHtml(input.url)}</p>
  `);

  return { subject, text, html };
}
