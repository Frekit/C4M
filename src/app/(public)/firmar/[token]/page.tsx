import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import {
  CircleCheckBigIcon,
  FileTextIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCompany } from "@/lib/company";
import { prisma } from "@/lib/db";
import {
  CONTRACT_KIND,
  CONTRACT_STATUS,
  SIGNATURE_STATUS,
} from "@/lib/domain/enums";
import { signSummaryBullets } from "@/lib/domain/contract-copy";
import { contractPaymentCopy } from "@/lib/domain/payment-copy";
import { formatDateTimeUtc } from "@/lib/format";
import { formatMoney } from "@/lib/money";

import { SignForm } from "./sign-form";

export const metadata: Metadata = {
  title: "Firmar contrato",
  robots: { index: false, follow: false },
};

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const company = getCompany();

  const request = await prisma.signatureRequest.findUnique({
    where: { token },
    include: {
      payee: true,
      contract: { include: { creator: true, parent: true, client: true } },
    },
  });

  if (!request) {
    return (
      <PageShell width="narrow" className="justify-center py-16">
        <Card>
          <CardHeader>
            <TriangleAlertIcon className="size-5 text-muted-foreground" />
            <h1 className="font-heading text-base leading-snug font-medium">Enlace no válido</h1>
            <CardDescription>
              Este enlace de firma no existe. Pide uno nuevo a la persona que te
              contactó.
            </CardDescription>
          </CardHeader>
        </Card>
      </PageShell>
    );
  }

  const { contract } = request;
  const isAnnex = contract.kind === CONTRACT_KIND.ANNEX;
  const isConditionsAnnex = contract.kind === CONTRACT_KIND.CONDITIONS_ANNEX;
  const totalCost = contract.costMinorPerContent * contract.deliverableCount;

  const isSigned = request.status === SIGNATURE_STATUS.SIGNED;
  const isExpired = request.expiresAt < new Date();
  const isUnusable =
    !isSigned &&
    (request.status === SIGNATURE_STATUS.REVOKED ||
      isExpired ||
      contract.status === CONTRACT_STATUS.CANCELLED);

  if (request.status === SIGNATURE_STATUS.PENDING) {
    await prisma.signatureRequest.update({
      where: { id: request.id },
      data: { status: SIGNATURE_STATUS.VIEWED, viewedAt: new Date() },
    });
  }

  const signedCard = isSigned ? (
    <Card>
      <CardHeader>
        <CircleCheckBigIcon className="size-5 text-muted-foreground" />
            <CardTitle>
              Contrato firmado{request.signedAt ? ` el ${formatDateTimeUtc(request.signedAt)}` : ""}
            </CardTitle>
        <CardDescription>
          Gracias{request.signerFullName ? `, ${request.signerFullName}` : ""}.
          Ya tenemos tus datos para pagarte.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Fecha de firma</dt>
            <dd>{formatDateTimeUtc(request.signedAt)}</dd>
          </div>
          {request.documentSha256 ? (
            <div className="grid gap-1">
              <dt className="text-muted-foreground">Huella del documento</dt>
              <dd className="font-mono text-xs break-all">
                {request.documentSha256}
              </dd>
            </div>
          ) : null}
        </dl>
        <Button
          className="w-fit"
          nativeButton={false}
          render={
            <a href={`/firmar/${token}/documento`} />
          }
        >
          <FileTextIcon />
          Descargar PDF firmado
        </Button>
      </CardContent>
    </Card>
  ) : null;

  return (
    <PageShell width="default" className="gap-5 pb-24">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{company.legalName}</p>
        <p className="font-mono text-eyebrow-11">Contrato {contract.code}</p>
        <h1 className="font-serif text-[26px] leading-8">
          {isConditionsAnnex
            ? `Anexo de condiciones al contrato ${contract.parent?.code ?? ""}`
            : isAnnex
              ? `Anexo al contrato ${contract.parent?.code ?? ""}`
              : `Hola. Este es tu contrato${contract.client ? ` con ${contract.client.name}` : ""}.`}
        </h1>
        <p className="text-sm text-muted-foreground">
          Referencia {contract.code} · para @{contract.creator.handle}
        </p>
      </div>

      {signedCard}

      <Card>
        <CardHeader>
          <CardTitle>Lo que se acuerda</CardTitle>
          <CardDescription>
            {isSigned
              ? "Este es el acuerdo que firmaste."
              : "Revísalo antes de firmar. Si algo no cuadra, contesta al correo con el que te llegó este enlace."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <ul className="grid gap-2 text-sm text-muted-foreground">
            {signSummaryBullets.map((bullet) => (
              <li key={bullet} className="pl-4">
                <span className="-ml-4 mr-2">·</span>
                {bullet}
              </li>
            ))}
          </ul>

          {isConditionsAnnex ? (
            <p className="text-sm">
              Este anexo no cambia el número de contenidos ni los importes del
              contrato {contract.parent?.code ?? "de origen"}.
            </p>
          ) : (
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Contenidos</dt>
                <dd className="font-medium">{contract.deliverableCount}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Importe por contenido</dt>
                <dd className="font-medium">
                  {formatMoney(
                    contract.costMinorPerContent,
                    contract.costCurrency,
                    { withCode: true }
                  )}
                </dd>
              </div>
              <div className="border-t" />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Importe total</dt>
                <dd className="text-base font-medium">
                  {formatMoney(totalCost, contract.costCurrency, {
                    withCode: true,
                  })}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Cobro</dt>
                <dd>
                  {
                    contractPaymentCopy({
                      settlementMode: contract.client?.settlementMode,
                      paymentTermDays: contract.paymentTermDays,
                    }).term
                  }
                </dd>
              </div>
            </dl>
          )}

          {contract.notes ? (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium">Condiciones particulares</p>
              <p className="mt-1 text-sm whitespace-pre-line">{contract.notes}</p>
            </div>
          ) : null}

          <Button
            variant="outline"
            className="w-fit"
            nativeButton={false}
            render={
              <a href={`/firmar/${token}/documento`} target="_blank" rel="noreferrer" />
            }
          >
            <FileTextIcon />
            Ver el contrato completo (PDF)
          </Button>
        </CardContent>
      </Card>

      {isSigned ? null : isUnusable ? (
        <Card>
          <CardHeader>
            <TriangleAlertIcon className="size-5 text-muted-foreground" />
            <CardTitle>Este enlace ya no sirve</CardTitle>
            <CardDescription>
              {contract.status === CONTRACT_STATUS.CANCELLED
                ? "El contrato se ha cancelado."
                : isExpired
                  ? "Este enlace ha caducado. Pide uno nuevo a tu contacto en Creators for Media."
                  : "El enlace se ha revocado. Pide uno nuevo a tu contacto en Creators for Media."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="space-y-1">
            <h2 className="font-heading text-lg font-medium">Tus datos</h2>
            <p className="text-sm text-muted-foreground">
              Se usan para el contrato y para pagarte después, así que no habrá que
              pedírtelos otra vez.
            </p>
          </div>
          <SignForm
            token={token}
            defaultCurrency={contract.costCurrency}
            defaultEmail={request.recipientEmail}
            summary={`${formatMoney(totalCost, contract.costCurrency, { withCode: true })} · ${contract.deliverableCount} contenidos`}
          />
        </>
      )}
    </PageShell>
  );
}
