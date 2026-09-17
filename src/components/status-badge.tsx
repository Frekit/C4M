import { Badge } from "@/components/ui/badge";
import {
  CONTRACT_STATUS,
  CONTRACT_STATUS_LABELS,
  SIGNATURE_STATUS,
  SIGNATURE_STATUS_LABELS,
  type ContractStatus,
  type SignatureStatus,
} from "@/lib/domain/enums";

type Variant = "default" | "secondary" | "outline" | "destructive";

const CONTRACT_VARIANTS: Record<ContractStatus, Variant> = {
  [CONTRACT_STATUS.DRAFT]: "outline",
  [CONTRACT_STATUS.SENT]: "secondary",
  [CONTRACT_STATUS.SIGNED]: "default",
  [CONTRACT_STATUS.COMPLETED]: "secondary",
  [CONTRACT_STATUS.RENEWED]: "outline",
  [CONTRACT_STATUS.CANCELLED]: "destructive",
};

export function ContractStatusBadge({ status }: { status: string }) {
  const key = status as ContractStatus;

  return (
    <Badge variant={CONTRACT_VARIANTS[key] ?? "outline"}>
      {CONTRACT_STATUS_LABELS[key] ?? status}
    </Badge>
  );
}

const SIGNATURE_VARIANTS: Record<SignatureStatus, Variant> = {
  [SIGNATURE_STATUS.PENDING]: "secondary",
  [SIGNATURE_STATUS.VIEWED]: "secondary",
  [SIGNATURE_STATUS.SIGNED]: "default",
  [SIGNATURE_STATUS.REVOKED]: "outline",
};

export function SignatureStatusBadge({ status }: { status: string }) {
  const key = status as SignatureStatus;

  return (
    <Badge variant={SIGNATURE_VARIANTS[key] ?? "outline"}>
      {SIGNATURE_STATUS_LABELS[key] ?? status}
    </Badge>
  );
}
