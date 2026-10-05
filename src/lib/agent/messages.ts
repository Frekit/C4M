import type { AppUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db";

import { aiActorLabel } from "./config";

export async function persistAgentTurn(input: {
  campaignId: string;
  user: AppUser;
  question: string;
  answer: string;
}) {
  const question = input.question.trim().slice(0, 8000);
  const answer = input.answer.trim().slice(0, 8000);
  if (!question && !answer) return;
  const askedAt = new Date();

  if (question) {
    await prisma.campaignMessage.create({
      data: {
        campaignId: input.campaignId,
        authorKind: "AGENCY",
        authorLabel: input.user.name || input.user.email,
        body: question,
        visibility: "INTERNAL",
        createdAt: askedAt,
      },
    });
  }

  if (answer) {
    await prisma.campaignMessage.create({
      data: {
        campaignId: input.campaignId,
        authorKind: "ASSISTANT",
        authorLabel: aiActorLabel(input.user.email),
        body: answer,
        visibility: "INTERNAL",
        createdAt: new Date(askedAt.getTime() + 1),
      },
    });
  }
}

/** Misma criba que /hablar: solo lo compartido o escrito por el cliente. */
export function clientThreadWhere(campaignId: string) {
  return {
    campaignId,
    OR: [{ visibility: "SHARED" }, { authorKind: "CLIENT" }],
  };
}
