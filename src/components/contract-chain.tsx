import Link from "next/link";
import type { Contract, Deliverable, SignatureRequest } from "@prisma/client";

import { ContractStatusBadge } from "@/components/status-badge";
import { Progress } from "@/components/ui/progress";
import { deliverableProgress } from "@/lib/domain/contract-math";
import { CONTRACT_KIND, CONTRACT_KIND_LABELS, type ContractKind } from "@/lib/domain/enums";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export type ChainContract = Contract & {
  deliverables: Deliverable[];
  signatureRequests: Omit<SignatureRequest, "documentPdf">[];
};

export function ContractChain({
  chain,
  currentId,
}: {
  chain: ChainContract[];
  currentId?: string;
}) {
  return (
    <ol className="grid gap-2">
      {chain.map((contract, index) => {
        const progress = deliverableProgress(contract.deliverables);
        const isCurrent = contract.id === currentId;

        return (
          <li key={contract.id} className="relative">
            {index > 0 ? (
              <span
                aria-hidden
                className="absolute -top-2 left-4 h-2 w-px bg-border"
              />
            ) : null}
            <Link
              href={`/contratos/${contract.id}`}
              className={`block rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
                isCurrent ? "border-primary bg-muted/30" : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{contract.code}</span>
                <span className="text-xs text-muted-foreground">
                  {CONTRACT_KIND_LABELS[contract.kind as ContractKind]}
                </span>
                <ContractStatusBadge status={contract.status} />
                {isCurrent ? (
                  <span className="text-xs text-muted-foreground">
                    · estás aquí
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {contract.kind === CONTRACT_KIND.CONDITIONS_ANNEX ? (
                  <span>Sin cambio de contenidos ni importes</span>
                ) : (
                  <>
                    <span>
                      {progress.published}/{progress.total} entregados
                    </span>
                    <span>
                      Coste{" "}
                      {formatMoney(
                        contract.costMinorPerContent * contract.deliverableCount,
                        contract.costCurrency
                      )}
                    </span>
                    <span>
                      Venta{" "}
                      {formatMoney(
                        contract.salePriceCentsPerContent *
                          contract.deliverableCount,
                        "USD"
                      )}
                    </span>
                  </>
                )}
                <span>{formatDate(contract.createdAt)}</span>
              </div>

              {contract.kind === CONTRACT_KIND.CONDITIONS_ANNEX ? null : (
                <Progress value={progress.ratio * 100} className="mt-2 h-1.5" />
              )}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
