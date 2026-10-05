import { mailSubjectFor } from "@/lib/runtime-env";

export type MailSendResult =
  | { status: "sent"; id?: string }
  | { status: "skipped"; reason: "not_configured" }
  | { status: "failed"; error: string };

const RESEND_URL = "https://api.resend.com/emails";

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function mailFromAddress(): string {
  const explicit = process.env.MAIL_FROM?.trim();
  if (explicit) return explicit;

  const company =
    process.env.COMPANY_EMAIL?.trim() || "finanzas@creatorsformedia.com";
  const name =
    process.env.COMPANY_LEGAL_NAME?.trim() || "Creators For Media";

  return `${name} <${company}>`;
}

export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<MailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    return { status: "skipped", reason: "not_configured" };
  }

  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: mailFromAddress(),
        to: [input.to],
        subject: mailSubjectFor(input.subject),
        text: input.text,
        html: input.html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        status: "failed",
        error: detail.slice(0, 300) || `Resend ${response.status}`,
      };
    }

    const payload = (await response.json().catch(() => null)) as {
      id?: string;
    } | null;

    return { status: "sent", id: payload?.id };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "No se ha podido enviar",
    };
  }
}

export function mailStatusCopy(result: MailSendResult): string {
  if (result.status === "sent") {
    return "El correo ha salido. Si no llega, copia el enlace y mándalo tú.";
  }
  if (result.status === "skipped") {
    return "El correo no está configurado: copia el enlace y mándalo tú.";
  }
  return `El correo no ha salido (${result.error}). Copia el enlace y mándalo tú.`;
}
