"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react";

import { MoneyInput } from "@/components/money-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CURRENCIES } from "@/lib/currencies";
import { PAYMENT_TERMS } from "@/lib/domain/enums";
import { convertToUsdCents, formatMoney, formatPercent, toMinorUnits } from "@/lib/money";

const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.code} · ${currency.name}`,
}));

function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized || !/^\d+(\.\d{1,3})?$/.test(normalized)) return null;
  return Number(normalized);
}

export type EconomicsDefaults = {
  deliverableCount?: number;
  salePricePerContent?: string;
  costCurrency?: string;
  costPerContent?: string;
  paymentTermDays?: number;
  notes?: string;
};

export function ContractEconomicsFields({
  fxRates,
  fieldErrors,
  defaults,
  lockCost = false,
  lockCostReason,
}: {
  fxRates: Record<string, number>;
  fieldErrors?: Record<string, string>;
  defaults?: EconomicsDefaults;
  lockCost?: boolean;
  lockCostReason?: string;
}) {
  const [deliverableCount, setDeliverableCount] = useState(
    String(defaults?.deliverableCount ?? 3)
  );
  const [salePrice, setSalePrice] = useState(defaults?.salePricePerContent ?? "");
  const [costCurrency, setCostCurrency] = useState(
    defaults?.costCurrency ?? "EUR"
  );
  const [costPrice, setCostPrice] = useState(defaults?.costPerContent ?? "");
  const [manualFx, setManualFx] = useState("");
  const [paymentTerm, setPaymentTerm] = useState(
    String(defaults?.paymentTermDays ?? 30)
  );
  const [customTerm, setCustomTerm] = useState(false);

  const storedRate = fxRates[costCurrency];
  const effectiveRate =
    costCurrency === "USD" ? 1 : (parseAmount(manualFx) ?? storedRate ?? null);

  const summary = useMemo(() => {
    const count = Number.parseInt(deliverableCount, 10);
    const sale = parseAmount(salePrice);
    const cost = parseAmount(costPrice);

    if (!count || count < 1 || sale === null || cost === null || !effectiveRate) {
      return null;
    }

    const saleCents = toMinorUnits(sale, "USD");
    const costMinor = toMinorUnits(cost, costCurrency);
    const costUsdCents = convertToUsdCents(costMinor, costCurrency, effectiveRate);

    const saleTotal = saleCents * count;
    const costTotalUsd = costUsdCents * count;
    const marginTotal = saleTotal - costTotalUsd;

    return {
      count,
      saleTotal,
      costTotalMinor: costMinor * count,
      costTotalUsd,
      costUsdCents,
      marginTotal,
      marginPerContent: saleCents - costUsdCents,
      marginRatio: saleTotal > 0 ? marginTotal / saleTotal : null,
    };
  }, [deliverableCount, salePrice, costPrice, costCurrency, effectiveRate]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="deliverableCount">Contenidos pactados</Label>
            <Input
              id="deliverableCount"
              name="deliverableCount"
              type="number"
              min={1}
              max={365}
              value={deliverableCount}
              onChange={(event) => setDeliverableCount(event.target.value)}
              aria-invalid={Boolean(fieldErrors?.deliverableCount)}
              required
            />
            {fieldErrors?.deliverableCount ? (
              <p className="text-xs text-destructive">
                {fieldErrors.deliverableCount}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Se creará un contenido por cada uno, para ir marcándolos al
                publicarse.
              </p>
            )}
          </div>

          <MoneyInput
            name="salePricePerContent"
            label="Precio de venta por contenido"
            currency="USD"
            value={salePrice}
            onValueChange={setSalePrice}
            error={fieldErrors?.salePricePerContent}
            description="Lo que se factura al cliente. Siempre en USD."
            required
          />
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="costCurrency">Moneda de pago al creator</Label>
            <div className="relative">
              <select
                id="costCurrency"
                name="costCurrency"
                value={costCurrency}
                onChange={(event) => setCostCurrency(event.target.value)}
                disabled={lockCost}
                required
                className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
              >
                {CURRENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute inset-y-0 right-2.5 my-auto size-4 text-muted-foreground" />
            </div>
            {/* Un select deshabilitado no se envía: el anexo necesita el valor igual. */}
            {lockCost ? (
              <input type="hidden" name="costCurrency" value={costCurrency} />
            ) : null}
            {fieldErrors?.costCurrency ? (
              <p className="text-xs text-destructive">{fieldErrors.costCurrency}</p>
            ) : null}
          </div>

          <MoneyInput
            name="costPerContent"
            label="Coste por contenido"
            currency={costCurrency}
            value={costPrice}
            onValueChange={setCostPrice}
            error={fieldErrors?.costPerContent}
            description={
              lockCost
                ? lockCostReason
                : "Lo que se le paga a él o a su agencia."
            }
            required
          />
        </div>

        {costCurrency === "USD" ? (
          <input type="hidden" name="fxUnitsPerUsd" value="" />
        ) : (
          <div className="grid gap-2">
            <Label htmlFor="fxUnitsPerUsd">
              Tipo de cambio ({costCurrency} por 1 USD)
            </Label>
            <Input
              id="fxUnitsPerUsd"
              name="fxUnitsPerUsd"
              inputMode="decimal"
              placeholder={storedRate ? String(storedRate) : "Escríbelo"}
              value={manualFx}
              onChange={(event) => setManualFx(event.target.value)}
              aria-invalid={Boolean(fieldErrors?.fxUnitsPerUsd)}
            />
            {fieldErrors?.fxUnitsPerUsd ? (
              <p className="text-xs text-destructive">
                {fieldErrors.fxUnitsPerUsd}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {storedRate
                  ? `Guardado: ${storedRate}. Déjalo vacío para usar ese, o escribe otro para congelar este contrato a un cambio distinto.`
                  : `No hay cambio guardado para ${costCurrency}: escríbelo para poder calcular el margen.`}
              </p>
            )}
          </div>
        )}

        <Separator />

        <div className="grid gap-2">
          <Label htmlFor="paymentTermSelect">
            Plazo de pago tras publicar cada contenido
          </Label>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_TERMS.map((term) => (
              <button
                key={term.days}
                type="button"
                onClick={() => {
                  setPaymentTerm(String(term.days));
                  setCustomTerm(false);
                }}
                className={`h-8 rounded-lg border px-3 text-sm transition-colors ${
                  !customTerm && paymentTerm === String(term.days)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input hover:bg-muted"
                }`}
              >
                {term.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomTerm(true)}
              className={`h-8 rounded-lg border px-3 text-sm transition-colors ${
                customTerm
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input hover:bg-muted"
              }`}
            >
              Otro
            </button>
          </div>
          {customTerm ? (
            <Input
              id="paymentTermSelect"
              type="number"
              min={0}
              max={365}
              value={paymentTerm}
              onChange={(event) => setPaymentTerm(event.target.value)}
              placeholder="Días"
              className="max-w-32"
            />
          ) : null}
          <input type="hidden" name="paymentTermDays" value={paymentTerm} />
          <p className="text-xs text-muted-foreground">
            La fecha de pago de cada contenido se calcula desde su fecha de
            publicación, no desde la factura.
          </p>
        </div>
      </div>

      <aside className="grid gap-3 self-start rounded-xl border bg-muted/30 p-4">
        <p className="text-sm font-medium">Resumen económico</p>

        {summary ? (
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Venta total</dt>
              <dd className="font-medium">
                {formatMoney(summary.saleTotal, "USD")}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Coste total</dt>
              <dd className="font-medium">
                {formatMoney(summary.costTotalMinor, costCurrency)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Coste en USD</dt>
              <dd>{formatMoney(summary.costTotalUsd, "USD")}</dd>
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Margen</dt>
              <dd
                className={
                  summary.marginTotal < 0
                    ? "font-medium text-destructive"
                    : "font-medium"
                }
              >
                {formatMoney(summary.marginTotal, "USD")}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">% margen</dt>
              <dd>
                {summary.marginRatio === null
                  ? "—"
                  : formatPercent(summary.marginRatio)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Coste por contenido</dt>
              <dd>{formatMoney(summary.costUsdCents, "USD")}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Rellena contenidos, precio de venta y coste para ver el margen.
            {costCurrency !== "USD" && !effectiveRate
              ? ` Falta el tipo de cambio de ${costCurrency}.`
              : ""}
          </p>
        )}

        {summary && summary.marginTotal < 0 ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Margen negativo</AlertTitle>
            <AlertDescription>
              El coste supera el precio de venta. Puedes guardarlo, pero quedará
              marcado.
            </AlertDescription>
          </Alert>
        ) : null}
      </aside>
    </div>
  );
}
