import type { PayeeProfile } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { maskAccount } from "@/lib/auth/permissions";
import {
  PAYEE_KIND_LABELS,
  PAYOUT_METHOD_LABELS,
  type PayeeKind,
  type PayoutMethod,
} from "@/lib/domain/enums";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right break-words">{value}</dd>
    </div>
  );
}

export function PayeeCard({
  payee,
  canSeeFullAccount,
}: {
  payee: PayeeProfile | null;
  canSeeFullAccount: boolean;
}) {
  if (!payee) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Datos de pago</CardTitle>
          <CardDescription>
            Se rellenan solos cuando el talento o su agencia firman el contrato
            desde el enlace de firma.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const account =
    payee.payoutMethod === "WISE"
      ? (payee.wiseEmail ?? "—")
      : (payee.iban ?? "—");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos de pago</CardTitle>
        <CardDescription>
          Los facilitó el firmante. {canSeeFullAccount ? "" : "La cuenta se muestra parcialmente según tu rol."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            {PAYEE_KIND_LABELS[payee.kind as PayeeKind]}
          </Badge>
          <Badge variant="secondary">
            {PAYOUT_METHOD_LABELS[payee.payoutMethod as PayoutMethod]}
          </Badge>
          {payee.vatApplies ? (
            <Badge variant="outline">IVA {payee.vatRate ?? 0}%</Badge>
          ) : null}
          {payee.withholdingApplies ? (
            <Badge variant="outline">
              Retención {payee.withholdingRate ?? 0}%
            </Badge>
          ) : null}
        </div>

        <dl className="grid gap-2">
          <Row label="Razón social" value={payee.legalName} />
          <Row label="NIF / Tax ID" value={payee.taxId} />
          <Row
            label="Domicilio"
            value={`${payee.addressLine}, ${payee.postalCode} ${payee.city}${
              payee.region ? ` (${payee.region})` : ""
            }, ${payee.country}`}
          />
          <Row label="Titular de la cuenta" value={payee.accountHolder} />
          <Row
            label={payee.payoutMethod === "WISE" ? "Cuenta Wise" : "IBAN"}
            value={canSeeFullAccount ? account : maskAccount(account)}
          />
          {payee.swiftBic ? (
            <Row
              label="SWIFT / BIC"
              value={canSeeFullAccount ? payee.swiftBic : maskAccount(payee.swiftBic)}
            />
          ) : null}
          {payee.bankName ? <Row label="Banco" value={payee.bankName} /> : null}
          <Row label="Moneda de pago" value={payee.payoutCurrency} />
          <Row label="Email de facturación" value={payee.billingEmail} />
          {payee.phone ? <Row label="Teléfono" value={payee.phone} /> : null}
          {payee.contactPerson ? (
            <Row label="Contacto" value={payee.contactPerson} />
          ) : null}
          {payee.taxRegime ? (
            <Row label="Régimen fiscal" value={payee.taxRegime} />
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}
