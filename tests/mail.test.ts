import assert from "node:assert/strict";
import { test } from "node:test";

import { invitationMailCopy, signatureMailCopy } from "@/lib/mail/templates";
import {
  isMailConfigured,
  mailFromAddress,
  mailStatusCopy,
  sendMail,
} from "@/lib/mail/send";

test("sin API key el correo no se intenta y hay que copiar el enlace", async () => {
  const previous = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  assert.equal(isMailConfigured(), false);
  const result = await sendMail({
    to: "talento@example.com",
    subject: "x",
    text: "x",
    html: "<p>x</p>",
  });
  assert.equal(result.status, "skipped");
  assert.match(mailStatusCopy(result), /copia el enlace/);

  if (previous === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = previous;
});

test("el correo de firma lleva código, handle y URL", () => {
  const copy = signatureMailCopy({
    handle: "dulceida",
    code: "CTR-2026-001",
    url: "http://localhost:43127/firmar/abc",
    expiresAt: new Date("2026-10-01T00:00:00.000Z"),
  });

  assert.match(copy.subject, /CTR-2026-001/);
  assert.match(copy.subject, /dulceida/);
  assert.match(copy.text, /firmar\/abc/);
  assert.match(copy.html, /Abrir y firmar/);
});

test("el correo de invitación nombra el rol", () => {
  const copy = invitationMailCopy({
    roleLabel: "Gestión de creators",
    url: "http://localhost:43127/invitacion/xyz",
    expiresAt: new Date("2026-10-01T00:00:00.000Z"),
  });

  assert.match(copy.text, /Gestión de creators/);
  assert.match(copy.html, /invitacion\/xyz/);
});

test("MAIL_FROM usa la empresa si no hay override", () => {
  const previousFrom = process.env.MAIL_FROM;
  const previousEmail = process.env.COMPANY_EMAIL;
  const previousName = process.env.COMPANY_LEGAL_NAME;
  delete process.env.MAIL_FROM;
  process.env.COMPANY_EMAIL = "ops@example.com";
  process.env.COMPANY_LEGAL_NAME = "Acme SL";

  assert.match(mailFromAddress(), /ops@example.com/);
  assert.match(mailFromAddress(), /Acme SL/);

  if (previousFrom === undefined) delete process.env.MAIL_FROM;
  else process.env.MAIL_FROM = previousFrom;
  if (previousEmail === undefined) delete process.env.COMPANY_EMAIL;
  else process.env.COMPANY_EMAIL = previousEmail;
  if (previousName === undefined) delete process.env.COMPANY_LEGAL_NAME;
  else process.env.COMPANY_LEGAL_NAME = previousName;
});
