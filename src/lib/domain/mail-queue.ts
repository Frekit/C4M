import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  MAIL_JOB_KIND,
  MAIL_JOB_STATUS,
  MAIL_PROCESS_BATCH,
} from "@/lib/domain/enums";
import { sendMail, type MailSendResult } from "@/lib/mail/send";

export type MailQueueReport = {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  remaining: number;
};

type MailDb = Prisma.TransactionClient | PrismaClient;

export async function enqueueSignatureMail(
  input: {
    toEmail: string;
    contractId: string;
    signatureRequestId: string;
    subject: string;
    text: string;
    html: string;
  },
  db: MailDb = prisma
) {
  return db.mailJob.create({
    data: {
      kind: MAIL_JOB_KIND.SIGNATURE,
      toEmail: input.toEmail,
      contractId: input.contractId,
      signatureRequestId: input.signatureRequestId,
      subject: input.subject,
      textBody: input.text,
      htmlBody: input.html,
      status: MAIL_JOB_STATUS.PENDING,
    },
  });
}

export async function pendingMailJobCount() {
  return prisma.mailJob.count({
    where: { status: MAIL_JOB_STATUS.PENDING },
  });
}

export async function processMailQueue(
  limit = MAIL_PROCESS_BATCH
): Promise<MailQueueReport> {
  const jobs = await prisma.mailJob.findMany({
    where: { status: MAIL_JOB_STATUS.PENDING },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs) {
    const result: MailSendResult = await sendMail({
      to: job.toEmail,
      subject: job.subject,
      text: job.textBody,
      html: job.htmlBody,
    });

    const nextStatus =
      result.status === "sent"
        ? MAIL_JOB_STATUS.SENT
        : result.status === "skipped"
          ? MAIL_JOB_STATUS.SKIPPED
          : MAIL_JOB_STATUS.FAILED;

    if (result.status === "sent") sent += 1;
    else if (result.status === "skipped") skipped += 1;
    else failed += 1;

    await prisma.mailJob.update({
      where: { id: job.id },
      data: {
        status: nextStatus,
        error: result.status === "failed" ? result.error : null,
        attempts: job.attempts + 1,
        processedAt: new Date(),
      },
    });
  }

  const remaining = await pendingMailJobCount();

  return {
    processed: jobs.length,
    sent,
    skipped,
    failed,
    remaining,
  };
}
