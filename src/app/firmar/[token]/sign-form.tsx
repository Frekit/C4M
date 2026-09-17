"use client";

import { useActionState, useState } from "react";
import {
  BanknoteIcon,
  BuildingIcon,
  ChevronDownIcon,
  PhoneIcon,
  ReceiptIcon,
} from "lucide-react";

import { FormErrorSummary } from "@/components/form-error-summary";
import { NativeSelectField } from "@/components/native-select-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NativeCheckboxField } from "@/components/native-checkbox-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const FIELD_LABELS: Record<string, string> = {
  kind: "Firmas como",
  legalName: "Nombre o razón social",
  taxId: "NIF / CIF / Tax ID",
  country: "País",
  addressLine: "Dirección",
  city: "Ciudad",
  postalCode: "Código postal",
  region: "Provincia o estado",
  accountHolder: "Titular de la cuenta",
  payoutMethod: "Método de pago",
  iban: "IBAN o número de cuenta",
  swiftBic: "SWIFT / BIC",
  bankName: "Banco",
  wiseEmail: "Email de Wise",
  payoutCurrency: "Moneda de cobro",
  vatRate: "Tipo de IVA",
  withholdingRate: "Tipo de retención",
  taxRegime: "Régimen fiscal",
  billingEmail: "Email de facturación",
  phone: "Teléfono",
  contactPerson: "Persona de contacto",
  signerFullName: "Nombre completo del firmante",
  acceptTerms: "Aceptación del contrato",
};

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

      <FormErrorSummary
        error={state?.error}
        fieldErrors={state?.fieldErrors}
        labels={FIELD_LABELS}
      />

      <Card>
        <CardHeader>
          <BuildingIcon className="size-4 text-muted-foreground" />
          <CardTitle>Datos fiscales</CardTitle>
          <CardDescription>
            Tal como deben aparecer en el contrato y en las facturas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <NativeSelectField
            name="kind"
            label="Firmas como"
            options={KIND_OPTIONS}
            defaultValue={PAYEE_KIND.INDIVIDUAL}
            error={errors.kind}
            className="sm:col-span-2"
            required
          />

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
            <div className="relative">
              <select
                id="payoutMethod"
                name="payoutMethod"
                value={payoutMethod}
                onChange={(event) => setPayoutMethod(event.target.value)}
                required
                className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
              >
                {Object.values(PAYOUT_METHOD).map((method) => (
                  <option key={method} value={method}>
                    {PAYOUT_METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute inset-y-0 right-2.5 my-auto size-4 text-muted-foreground" />
            </div>
            {errors.payoutMethod ? (
              <p className="text-xs text-destructive">{errors.payoutMethod}</p>
            ) : null}
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

          <NativeSelectField
            name="payoutCurrency"
            label="Moneda en la que quieres cobrar"
            options={CURRENCY_OPTIONS}
            defaultValue={defaultCurrency}
            error={errors.payoutCurrency}
            className="sm:col-span-2"
            required
          />
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
          <NativeCheckboxField
            name="vatApplies"
            title="Mis facturas llevan IVA"
            description="Marca esto si estás dado de alta y repercutes IVA."
            checked={vatApplies}
            onCheckedChange={setVatApplies}
          />

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

          <NativeCheckboxField
            name="withholdingApplies"
            title="Se me practica retención de IRPF"
            description="Habitual en profesionales residentes en España."
            checked={withholdingApplies}
            onCheckedChange={setWithholdingApplies}
          />

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

          <NativeCheckboxField
            name="acceptTerms"
            title="He leído y acepto el contrato"
            description="Declaro que los datos facilitados son correctos."
            error={errors.acceptTerms}
          />

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Firmando…" : "Firmar contrato"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
