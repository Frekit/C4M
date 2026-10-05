"use client";

import { useActionState, useState } from "react";
import {
  BanknoteIcon,
  BuildingIcon,
  PhoneIcon,
  ReceiptIcon,
} from "lucide-react";

import { Field as AccessibleField } from "@/components/field";
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
import { CURRENCIES } from "@/lib/currencies";
import {
  PAYEE_KIND,
  PAYEE_KIND_LABELS,
  PAYOUT_METHOD,
} from "@/lib/domain/enums";

import {
  signContract,
  type SignFormValues,
  type SignResult,
} from "./actions";

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
  billingEmail: "Email de cobro (Zexel)",
  payoutCurrency: "Moneda de cobro",
  vatRate: "Tipo de IVA",
  withholdingRate: "Tipo de retención",
  taxRegime: "Régimen fiscal",
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
  className,
}: {
  name: string;
  label: string;
  error?: string;
  children: React.ReactElement;
  hint?: string;
  className?: string;
}) {
  return (
    <AccessibleField
      id={name}
      label={label}
      error={error}
      description={hint}
      className={className}
    >
      {children}
    </AccessibleField>
  );
}

export function SignForm({
  token,
  defaultCurrency,
  defaultEmail,
  summary,
}: {
  token: string;
  defaultCurrency: string;
  defaultEmail: string;
  summary?: string;
}) {
  const [state, formAction, pending] = useActionState<
    SignResult | null,
    FormData
  >(signContract, null);

  // Tras un error, React 19 resetea el <form> a los defaultValue del primer
  // render (vacíos). Remontar con lo que devolvió el servidor conserva lo
  // que el firmante ya había escrito.
  return (
    <SignFormFields
      key={state?.attempt ?? 0}
      token={token}
      defaultCurrency={defaultCurrency}
      defaultEmail={defaultEmail}
      summary={summary}
      values={state?.values}
      state={state}
      formAction={formAction}
      pending={pending}
    />
  );
}

function SignFormFields({
  token,
  defaultCurrency,
  defaultEmail,
  summary,
  values,
  state,
  formAction,
  pending,
}: {
  token: string;
  defaultCurrency: string;
  defaultEmail: string;
  summary?: string;
  values?: SignFormValues;
  state: SignResult | null;
  formAction: (payload: FormData) => void;
  pending: boolean;
}) {
  const [vatApplies, setVatApplies] = useState(Boolean(values?.vatApplies));
  const [withholdingApplies, setWithholdingApplies] = useState(
    Boolean(values?.withholdingApplies)
  );

  const errors = state?.fieldErrors ?? {};
  const [step, setStep] = useState(() => {
    if (!state?.fieldErrors) return 1;
    if (state.fieldErrors.signerFullName || state.fieldErrors.acceptTerms) return 3;
    return 2;
  });

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <input type="hidden" name="token" value={token} />

      <FormErrorSummary
        id="sign-form-errors"
        error={state?.error}
        fieldErrors={state?.fieldErrors}
        labels={FIELD_LABELS}
      />

      <div className="grid gap-2">
        <p className="text-label-13">
          Paso {step} de 3 · {step === 1 ? "Revisa" : step === 2 ? "Tus datos de cobro" : "Firma"}
        </p>
        <div className="flex gap-1" aria-hidden>
          {[1, 2, 3].map((item) => (
            <span
              key={item}
              className={item <= step ? "h-1 flex-1 rounded-full bg-primary" : "h-1 flex-1 rounded-full bg-muted"}
            />
          ))}
        </div>
        {summary ? <p className="text-heading-20">{summary}</p> : null}
      </div>

      {step === 1 ? (
        <div className="grid gap-3">
          <p className="text-copy-14 text-muted-foreground">
            Lee el acuerdo. Si algo no cuadra, escríbenos antes de firmar.
          </p>
          <Button type="button" onClick={() => setStep(2)}>
            Continuar
          </Button>
        </div>
      ) : null}

      <div className={step === 2 ? "grid gap-5" : "hidden"}>
      <Card>
        <CardHeader>
          <BuildingIcon className="size-4 text-muted-foreground" />
          <CardTitle>Quién eres</CardTitle>
          <CardDescription>
            Tal como deben aparecer en el contrato y en las facturas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <NativeSelectField
            name="kind"
            label="Firmas como"
            options={KIND_OPTIONS}
            defaultValue={values?.kind || PAYEE_KIND.INDIVIDUAL}
            error={errors.kind}
            className="sm:col-span-2"
            required
          />

          <Field
            name="legalName"
            label="Nombre o razón social"
            error={errors.legalName}
          >
            <Input
              id="legalName"
              name="legalName"
              autoComplete="organization"
              defaultValue={values?.legalName ?? ""}
              aria-invalid={Boolean(errors.legalName)}
              required
            />
          </Field>

          <Field name="taxId" label="NIF / CIF / Tax ID" error={errors.taxId}>
            <Input
              id="taxId"
              name="taxId"
              autoComplete="off"
              defaultValue={values?.taxId ?? ""}
              aria-invalid={Boolean(errors.taxId)}
              required
            />
          </Field>

          <Field
            name="addressLine"
            label="Dirección"
            error={errors.addressLine}
          >
            <Input
              id="addressLine"
              name="addressLine"
              autoComplete="street-address"
              defaultValue={values?.addressLine ?? ""}
              aria-invalid={Boolean(errors.addressLine)}
              required
            />
          </Field>

          <Field name="city" label="Ciudad" error={errors.city}>
            <Input
              id="city"
              name="city"
              autoComplete="address-level2"
              defaultValue={values?.city ?? ""}
              aria-invalid={Boolean(errors.city)}
              required
            />
          </Field>

          <Field
            name="postalCode"
            label="Código postal"
            error={errors.postalCode}
          >
            <Input
              id="postalCode"
              name="postalCode"
              autoComplete="postal-code"
              defaultValue={values?.postalCode ?? ""}
              aria-invalid={Boolean(errors.postalCode)}
              required
            />
          </Field>

          <Field
            name="region"
            label="Provincia o estado (opcional)"
            error={errors.region}
          >
            <Input
              id="region"
              name="region"
              autoComplete="address-level1"
              defaultValue={values?.region ?? ""}
            />
          </Field>

          <Field name="country" label="País" error={errors.country}>
            <Input
              id="country"
              name="country"
              autoComplete="country-name"
              defaultValue={values?.country ?? ""}
              aria-invalid={Boolean(errors.country)}
              required
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <BanknoteIcon className="size-4 text-muted-foreground" />
          <CardTitle>Dónde cobras</CardTitle>
          <CardDescription>
            Pagamos en lotes a través de Zexel Pay. Con este email te llega el
            cobro; ellos recogen tu cuenta y el KYC. No hace falta IBAN ni
            Wise aquí.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="payoutMethod" value={PAYOUT_METHOD.ZEXEL} />

          <Field
            name="billingEmail"
            label="Email de cobro"
            error={errors.billingEmail}
            hint="El mismo con el que te darás de alta en Zexel, si aún no tienes cuenta."
            className="sm:col-span-2"
          >
            <Input
              id="billingEmail"
              name="billingEmail"
              type="email"
              autoComplete="email"
              defaultValue={values ? values.billingEmail : defaultEmail}
              aria-invalid={Boolean(errors.billingEmail)}
              required
            />
          </Field>

          <NativeSelectField
            name="payoutCurrency"
            label="Moneda en la que quieres cobrar"
            options={CURRENCY_OPTIONS}
            defaultValue={values?.payoutCurrency || defaultCurrency}
            error={errors.payoutCurrency}
            className="sm:col-span-2"
            required
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <ReceiptIcon className="size-4 text-muted-foreground" />
          <CardTitle>Impuestos</CardTitle>
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
                defaultValue={values?.vatRate ?? ""}
                aria-invalid={Boolean(errors.vatRate)}
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
                defaultValue={values?.withholdingRate ?? ""}
                aria-invalid={Boolean(errors.withholdingRate)}
                className="max-w-32"
              />
            </Field>
          ) : null}

          <Field
            name="taxRegime"
            label="Régimen o notas fiscales (opcional)"
            error={errors.taxRegime}
          >
            <Input
              id="taxRegime"
              name="taxRegime"
              placeholder="Autónomo, exento…"
              defaultValue={values?.taxRegime ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <PhoneIcon className="size-4 text-muted-foreground" />
          <CardTitle>Contacto</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field name="phone" label="Teléfono (opcional)" error={errors.phone}>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={values?.phone ?? ""}
            />
          </Field>

          <Field
            name="contactPerson"
            label="Persona de contacto (opcional)"
            error={errors.contactPerson}
            hint="Rellénalo si firmas en nombre de una agencia."
          >
            <Input
              id="contactPerson"
              name="contactPerson"
              defaultValue={values?.contactPerson ?? ""}
            />
          </Field>
        </CardContent>
      </Card>
      <Button type="button" className="w-fit" onClick={() => setStep(3)}>
        Continuar
      </Button>
      </div>

      <div className={step === 3 ? "grid gap-3" : "hidden"}>
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
            label="Nombre completo del firmante"
            error={errors.signerFullName}
            hint="Esto queda registrado como tu firma, junto con la fecha y tu IP."
          >
            <Input
              id="signerFullName"
              name="signerFullName"
              defaultValue={values?.signerFullName ?? ""}
              aria-invalid={Boolean(errors.signerFullName)}
              required
            />
          </Field>

          <NativeCheckboxField
            name="acceptTerms"
            title="He leído y acepto el contrato"
            description="Declaro que los datos facilitados son correctos."
            defaultChecked={Boolean(values?.acceptTerms)}
            error={errors.acceptTerms}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Editar datos
            </Button>
            <Button type="submit" size="lg" disabled={pending} data-primary="true">
              {pending ? "Firmando…" : "Firmar contrato"}
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 border-t bg-background px-3 py-3 min-[761px]:hidden">
        <span className="text-label-13">{summary ?? `Paso ${step} de 3`}</span>
        {step < 3 ? (
          <Button type="button" onClick={() => setStep((value) => Math.min(3, value + 1))}>
            Continuar
          </Button>
        ) : (
          <span className="text-copy-12 text-fg-subtle">Paso 3 de 3</span>
        )}
      </div>
    </form>
  );
}
