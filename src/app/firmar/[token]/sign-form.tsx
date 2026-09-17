"use client";

import { useActionState, useState } from "react";
import { BanknoteIcon, BuildingIcon, PhoneIcon, ReceiptIcon } from "lucide-react";

import { SelectField } from "@/components/select-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currencies";
import {
  PAYEE_KIND,
  PAYEE_KIND_LABELS,
  PAYOUT_METHOD,
  PAYOUT_METHOD_LABELS,
} from "@/lib/domain/enums";

import { signContract, type SignResult } from "./actions";

const KIND_OPTIONS = Object.values(PAYEE_KIND).map((kind) => ({
  value: kind,
  label: PAYEE_KIND_LABELS[kind],
}));

const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.code} · ${currency.name}`,
}));

function Field({
  name,
  label,
  error,
  children,
  hint,
}: {
  name: string;
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function SignForm({
  token,
  defaultCurrency,
  defaultEmail,
}: {
  token: string;
  defaultCurrency: string;
  defaultEmail: string;
}) {
  const [state, formAction, pending] = useActionState<SignResult | null, FormData>(
    signContract,
    null
  );

  const [payoutMethod, setPayoutMethod] = useState<string>(
    PAYOUT_METHOD.BANK_TRANSFER
  );
  const [vatApplies, setVatApplies] = useState(false);
  const [withholdingApplies, setWithholdingApplies] = useState(false);

  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="token" value={token} />

      {state?.error ? (
        <Alert variant="destructive">
          <AlertTitle>No se ha podido firmar</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <BuildingIcon className="size-4 text-muted-foreground" />
          <CardTitle>Datos fiscales</CardTitle>
          <CardDescription>
            Tal como deben aparecer en el contrato y en las facturas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SelectField
              name="kind"
              label="Firmas como"
              options={KIND_OPTIONS}
              defaultValue={PAYEE_KIND.INDIVIDUAL}
            />
          </div>

          <Field name="legalName" label="Nombre o razón social" error={errors.legalName}>
            <Input id="legalName" name="legalName" autoComplete="organization" required />
          </Field>

          <Field name="taxId" label="NIF / CIF / Tax ID" error={errors.taxId}>
            <Input id="taxId" name="taxId" autoComplete="off" required />
          </Field>

          <Field name="addressLine" label="Dirección" error={errors.addressLine}>
            <Input
              id="addressLine"
              name="addressLine"
              autoComplete="street-address"
              required
            />
          </Field>

          <Field name="city" label="Ciudad" error={errors.city}>
            <Input id="city" name="city" autoComplete="address-level2" required />
          </Field>

          <Field name="postalCode" label="Código postal" error={errors.postalCode}>
            <Input id="postalCode" name="postalCode" autoComplete="postal-code" required />
          </Field>

          <Field name="region" label="Provincia o estado (opcional)" error={errors.region}>
            <Input id="region" name="region" autoComplete="address-level1" />
          </Field>

          <Field name="country" label="País" error={errors.country}>
            <Input id="country" name="country" autoComplete="country-name" required />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <BanknoteIcon className="size-4 text-muted-foreground" />
          <CardTitle>Datos de cobro</CardTitle>
          <CardDescription>
            Es la cuenta donde se pagarán los contenidos publicados.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            name="accountHolder"
            label="Titular de la cuenta"
            error={errors.accountHolder}
          >
            <Input id="accountHolder" name="accountHolder" required />
          </Field>

          <div className="grid gap-2">
            <Label htmlFor="payoutMethod">Método de pago</Label>
            <Select
              name="payoutMethod"
              items={Object.values(PAYOUT_METHOD).map((method) => ({
                value: method,
                label: PAYOUT_METHOD_LABELS[method],
              }))}
              value={payoutMethod}
              onValueChange={(value) => setPayoutMethod(String(value))}
            >
              <SelectTrigger id="payoutMethod" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(PAYOUT_METHOD).map((method) => (
                  <SelectItem key={method} value={method}>
                    {PAYOUT_METHOD_LABELS[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {payoutMethod === PAYOUT_METHOD.WISE ? (
            <Field
              name="wiseEmail"
              label="Email de la cuenta de Wise"
              error={errors.wiseEmail}
            >
              <Input id="wiseEmail" name="wiseEmail" type="email" />
            </Field>
          ) : (
            <>
              <Field name="iban" label="IBAN o número de cuenta" error={errors.iban}>
                <Input id="iban" name="iban" autoComplete="off" />
              </Field>
              <Field name="swiftBic" label="SWIFT / BIC (opcional)" error={errors.swiftBic}>
                <Input id="swiftBic" name="swiftBic" autoComplete="off" />
              </Field>
              <Field name="bankName" label="Banco (opcional)" error={errors.bankName}>
                <Input id="bankName" name="bankName" autoComplete="off" />
              </Field>
            </>
          )}

          <div className="sm:col-span-2">
            <SelectField
              name="payoutCurrency"
              label="Moneda en la que quieres cobrar"
              options={CURRENCY_OPTIONS}
              defaultValue={defaultCurrency}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <ReceiptIcon className="size-4 text-muted-foreground" />
          <CardTitle>Situación fiscal</CardTitle>
          <CardDescription>
            Determina si tus facturas llevan IVA y si se te practica retención.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              name="vatApplies"
              checked={vatApplies}
              onCheckedChange={(checked) => setVatApplies(Boolean(checked))}
            />
            <span className="grid gap-1">
              <span className="text-sm font-medium">Mis facturas llevan IVA</span>
              <span className="text-xs text-muted-foreground">
                Marca esto si estás dado de alta y repercutes IVA.
              </span>
            </span>
          </label>

          {vatApplies ? (
            <Field name="vatRate" label="Tipo de IVA (%)" error={errors.vatRate}>
              <Input
                id="vatRate"
                name="vatRate"
                inputMode="decimal"
                placeholder="21"
                className="max-w-32"
              />
            </Field>
          ) : null}

          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              name="withholdingApplies"
              checked={withholdingApplies}
              onCheckedChange={(checked) => setWithholdingApplies(Boolean(checked))}
            />
            <span className="grid gap-1">
              <span className="text-sm font-medium">
                Se me practica retención de IRPF
              </span>
              <span className="text-xs text-muted-foreground">
                Habitual en profesionales residentes en España.
              </span>
            </span>
          </label>

          {withholdingApplies ? (
            <Field
              name="withholdingRate"
              label="Tipo de retención (%)"
              error={errors.withholdingRate}
            >
              <Input
                id="withholdingRate"
                name="withholdingRate"
                inputMode="decimal"
                placeholder="15"
                className="max-w-32"
              />
            </Field>
          ) : null}

          <Field
            name="taxRegime"
            label="Régimen o notas fiscales (opcional)"
            error={errors.taxRegime}
          >
            <Input id="taxRegime" name="taxRegime" placeholder="Autónomo, exento…" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <PhoneIcon className="size-4 text-muted-foreground" />
          <CardTitle>Contacto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            name="billingEmail"
            label="Email de facturación"
            error={errors.billingEmail}
          >
            <Input
              id="billingEmail"
              name="billingEmail"
              type="email"
              defaultValue={defaultEmail}
              required
            />
          </Field>

          <Field name="phone" label="Teléfono (opcional)" error={errors.phone}>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" />
          </Field>

          <Field
            name="contactPerson"
            label="Persona de contacto (opcional)"
            error={errors.contactPerson}
            hint="Rellénalo si firmas en nombre de una agencia."
          >
            <Input id="contactPerson" name="contactPerson" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firma</CardTitle>
          <CardDescription>
            Al firmar aceptas las condiciones del contrato que aparece arriba.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field
            name="signerFullName"
            label="Escribe tu nombre completo"
            error={errors.signerFullName}
            hint="Esto queda registrado como tu firma, junto con la fecha y tu IP."
          >
            <Input id="signerFullName" name="signerFullName" required />
          </Field>

          <label className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox name="acceptTerms" />
            <span className="grid gap-1">
              <span className="text-sm font-medium">
                He leído y acepto el contrato
              </span>
              <span className="text-xs text-muted-foreground">
                Declaro que los datos facilitados son correctos.
              </span>
            </span>
          </label>
          {errors.acceptTerms ? (
            <p className="text-xs text-destructive">{errors.acceptTerms}</p>
          ) : null}

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Firmando…" : "Firmar contrato"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
