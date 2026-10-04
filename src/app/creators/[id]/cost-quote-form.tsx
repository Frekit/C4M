"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  deleteCreatorCostQuote,
  saveCreatorCostQuote,
  type CostQuoteResult,
} from "@/app/creators/cost-quote-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/lib/currencies";
import {
  IG_COST_FORMAT,
  IG_COST_FORMAT_LABELS,
  costPackageLabel,
  isIgCostFormat,
  type IgCostFormat,
} from "@/lib/domain/creator-cost-quote";
import { formatMoney } from "@/lib/money";

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-sm dark:bg-input/30";

export type CostQuoteRow = {
  id: string;
  format: string;
  quantity: number;
  costMinor: number;
  currency: string;
};

export function CreatorCostQuotes({
  creatorId,
  canWrite,
  quotes,
}: {
  creatorId: string;
  canWrite: boolean;
  quotes: CostQuoteRow[];
}) {
  return (
    <div className="grid gap-4">
      {quotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay paquetes. Un reel, tres reels y una story son tres
          costes distintos.
        </p>
      ) : (
        <ul className="grid gap-2">
          {quotes.map((quote) => (
            <li
              key={quote.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <p className="text-sm">
                <span className="font-medium">
                  {isIgCostFormat(quote.format)
                    ? costPackageLabel(quote.format, quote.quantity)
                    : `${quote.quantity} ${quote.format}`}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {formatMoney(quote.costMinor, quote.currency)}
                </span>
              </p>
              {canWrite ? (
                <form action={deleteCreatorCostQuote}>
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <Button type="submit" size="sm" variant="ghost">
                    Quitar
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {canWrite ? <CostQuoteForm creatorId={creatorId} /> : null}
    </div>
  );
}

function CostQuoteForm({ creatorId }: { creatorId: string }) {
  const [state, formAction, pending] = useActionState<
    CostQuoteResult | null,
    FormData
  >(saveCreatorCostQuote, null);
  const [format, setFormat] = useState<IgCostFormat>(IG_COST_FORMAT.REEL);
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("Coste de formato guardado.");
      setAmount("");
      setEpoch((value) => value + 1);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form key={epoch} action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="creatorId" value={creatorId} />
      <div className="grid gap-1">
        <Label htmlFor="cost-format" className="text-xs">
          Formato
        </Label>
        <select
          id="cost-format"
          name="format"
          value={format}
          onChange={(event) => setFormat(event.target.value as IgCostFormat)}
          className={selectClass}
        >
          {Object.values(IG_COST_FORMAT).map((value) => (
            <option key={value} value={value}>
              {IG_COST_FORMAT_LABELS[value]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="cost-quantity" className="text-xs">
          Cantidad
        </Label>
        <Input
          id="cost-quantity"
          name="quantity"
          inputMode="numeric"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="w-20"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="cost-amount" className="text-xs">
          Coste del paquete
        </Label>
        <Input
          id="cost-amount"
          name="amount"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="150"
          className="w-28"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="cost-currency" className="text-xs">
          Moneda
        </Label>
        <select
          id="cost-currency"
          name="currency"
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          className={`${selectClass} w-24`}
        >
          {CURRENCIES.map((item) => (
            <option key={item.code} value={item.code}>
              {item.code}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Guardando…" : "Añadir coste"}
      </Button>
    </form>
  );
}
